const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const multer = require("multer");
const AdmZip = require("adm-zip");
const crypto = require("crypto");

const LANGS_FILE = path.join(__dirname, "../langs.json");
const COUNTER_KEY = "project_counter";
const LAST_PROJECTS_KEY = "projects:recent";

const Profanease = require("profanease");
const filter = new Profanease({ lang: "all" });
filter.addWords(["automodmute"]);

module.exports = async (req, res, db, dirname) => {
  const tmpDir = path.join(dirname, "tmp");
  const projectsDir = path.join(dirname, "telewarp-projects");

  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(projectsDir, { recursive: true });

  // ---------------- load supported languages ----------------
  let langs;
  try {
    langs = JSON.parse(await fs.readFile(LANGS_FILE, "utf8"));
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
      upload.single("projectFile")(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  try {
    await handleUpload();

    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();

    let projectJson = null;
    let totalAssetsSize = 0;

    const filesToWrite = [];
    for (const entry of entries) {
    if (entry.isDirectory) continue;

    const data = entry.getData();
    const size = data.length;
    const name = path.basename(entry.entryName); // keep original filename

    if (name === "project.json") {
        if (size > 10 * 1024 * 1024) 
        throw new Error("project.json exceeds 10MB limit");
        projectJson = JSON.parse(data.toString("utf8"));
        continue;
    }

    if (size > 15 * 1024 * 1024) {
        // reject individual files >15MB
        throw new Error(`Asset ${name} exceeds 15MB limit`);
    }

    const filePath = path.join(projectsDir, name);
    if (!fsSync.existsSync(filePath)) {
        await fs.writeFile(filePath, data);
    }

    filesToWrite.push({ name, size });
    }

    if (!projectJson) throw new Error("ZIP must contain project.json");

    // ---------------- validate platform ID ----------------
    const langId = req.body.langId || projectJson.lang_id;
    if (!langId || !langs.find((l) => l.id === langId)) throw new Error("Invalid or missing platform ID");

    // ---------------- generate new project ID ----------------
    counter += 1n;
    const projectId = counter.toString();
    await db.put(COUNTER_KEY, projectId);

    // ---------------- check for naughty words ----------------
    const projectName = req.body.projectName || "";
    if (filter.check(projectName)) {
      return res.status(400).json({ error: "Project name contains inappropriate language" });
    }

    let projectDescription = req.body.projectDescription || "";
    if (filter.check(projectDescription)) projectDescription = "";

    // ---------------- store project metadata ----------------
    const projectData = {
      id: projectId,
      name: projectName || projectJson.name || "Untitled",
      description: projectDescription,
      lang_id: langId,
      metadata: projectJson,
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
    await fs.unlink(req.file.path);

    res.json({ success: true, id: projectId });
  } catch (err) {
    console.error(err);
    await fs.unlink(req.file?.path || "").catch(() => {});
    let message;
    if (err.message.includes("project.json")) message = "project.json must be ≤ 10MB";
    else if (err.message.includes("Assets")) message = "Assets must be ≤ 5MB total";
    else if (err.message.includes("platform")) message = "Invalid platform ID";
    else message = "Upload processing failed";
    res.status(400).json({ error: message });
  }
};
