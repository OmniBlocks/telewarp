const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const multer = require("multer");
const AdmZip = require("adm-zip");

const LANGS_FILE = path.join(__dirname, "../langs.json");
const COUNTER_KEY = "project_counter";
const LAST_PROJECTS_KEY = "projects:recent";

const Profanease = require("profanease");
const filter = new Profanease({ lang: "en" });
filter.addWords(["automodmute"]);
filter.removeWords(["dang", "damn", "hell", "crap", "lmao", "button", "buttons"]);

let langsCache;

module.exports = async (req, res, db, dirname) => {
  const tmpDir = path.join(dirname, "tmp");
  const projectsDir = path.join(dirname, "telewarp-projects");

  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(projectsDir, { recursive: true });

  // ---------------- load supported languages ----------------
  let langs;
  try {
    if (!langsCache) langsCache = JSON.parse(await fs.readFile(LANGS_FILE, "utf8"));
    langs = langsCache;
  } catch {
    return res.status(500).json({ error: "Could not load languages file" });
  }

  // ---------------- get counter ----------------
  let counter;
  try {
    counter = BigInt(await db.get(COUNTER_KEY));
  } catch {
    counter = 0n;
    await db.put(COUNTER_KEY, counter.toString());
  }

  // ---------------- handle file upload ----------------
  const upload = multer({ dest: tmpDir });
  const handleUpload = () =>
    new Promise((resolve, reject) => {
      upload.fields([
        { name: "projectFile", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 }
      ])(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  try {
    await handleUpload();

    const projectFile = req.files?.projectFile?.[0];
    const thumbFile = req.files?.thumbnail?.[0]; // optional

    if (!projectFile) return res.status(400).json({ error: "No project file uploaded" });

    // ---------------- extract ZIP ----------------
    const zip = new AdmZip(projectFile.path);
    const entries = zip.getEntries();

    let projectJson = null;
    const writePromises = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const data = entry.getData();
      const size = data.length;
      const name = path.basename(entry.entryName);

      if (name === "project.json") {
        if (size > 10 * 1024 * 1024) throw new Error("project.json exceeds 10MB limit");
        projectJson = JSON.parse(data.toString("utf8"));
        continue;
      }

      if (size > 15 * 1024 * 1024) throw new Error(`Asset ${name} exceeds 15MB limit`);

      const filePath = path.join(projectsDir, name);
      // write only if file doesn't exist
      writePromises.push(fs.writeFile(filePath, data, { flag: 'wx' }).catch(() => {}));
    }
    await Promise.all(writePromises);

    if (!projectJson) throw new Error("ZIP must contain project.json");

    // ---------------- validate platform ID ----------------
    const langId = req.body.langId || projectJson.lang_id;
    if (!langId || !langs.find(l => l.id === langId)) throw new Error("Invalid or missing platform ID");

    // ---------------- generate new project ID ----------------
    counter += 1n;
    const projectId = counter.toString();
    await db.put(COUNTER_KEY, projectId);

    // ---------------- check for inappropriate words ----------------
    let projectName = req.body.projectName || projectJson.name || "Untitled";
    if (filter.check(projectName)) return res.status(400).json({ error: "Project name contains inappropriate language" });

    let projectDescription = req.body.projectDescription || "";
    if (filter.check(projectDescription)) projectDescription = "";

    // ---------------- store thumbnail ----------------
    let thumbnailPath = null;
    if (thumbFile) {
      if (thumbFile.size > 2 * 1024 * 1024) return res.status(400).json({ error: "Thumbnail exceeds 2MB limit" });
      const thumbName = `thumb_${projectId}${path.extname(thumbFile.originalname)}`;
      thumbnailPath = path.join(projectsDir, thumbName);
      await fs.rename(thumbFile.path, thumbnailPath); // move instead of read/write
    }

    // ---------------- store project metadata ----------------
    const projectData = {
      id: projectId,
      name: projectName,
      description: projectDescription,
      lang_id: langId,
      metadata: projectJson,
      thumbnail: !!thumbnailPath,
      created_at: Date.now(),
    };

    await db.put(`project:${projectId}`, projectData);
    await db.put(`projects_by_time:${Date.now()}:${projectId}`, projectId);

    // ---------------- update last 20 projects ----------------
    let recentProjects;
    try { 
      recentProjects = await db.get(LAST_PROJECTS_KEY); 
      if (!Array.isArray(recentProjects)) recentProjects = []; 
    } catch { 
      recentProjects = []; 
    }
    recentProjects.push(projectId);
    if (recentProjects.length > 20) recentProjects = recentProjects.slice(-20);
    await db.put(LAST_PROJECTS_KEY, recentProjects);

    // ---------------- cleanup ----------------
    await fs.unlink(projectFile.path);

    res.json({ success: true, id: projectId });
  } catch (err) {
    console.error(err);
    // safely cleanup uploaded files
    await fs.unlink(req.files?.projectFile?.[0]?.path || "").catch(() => {});
    await fs.unlink(req.files?.thumbnail?.[0]?.path || "").catch(() => {});
    res.status(400).json({ error: err.message || "Upload processing failed" });
  }
};
