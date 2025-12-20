const path = require("path");
const fs = require("fs/promises");
const multer = require("multer");
const AdmZip = require("adm-zip");

const LANGS_FILE = path.join(__dirname, "../langs.json");
const COUNTER_KEY = "project_counter";
const LAST_PROJECTS_KEY = "projects:recent"; // track last 20 projects

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

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();

    let projectJson = null;
    let projectJsonSize = 0;
    let totalAssetsSize = 0;
    const filesToWrite = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const name = path.basename(entry.entryName);
      const data = entry.getData();
      const size = data.length;

      if (name === "project.json") {
        projectJsonSize = size;
        if (projectJsonSize > 10 * 1024 * 1024)
          throw new Error("project.json exceeds 10MB limit");
        projectJson = JSON.parse(data.toString("utf8"));
      } else {
        totalAssetsSize += size;
        if (totalAssetsSize > 5 * 1024 * 1024)
          throw new Error("Assets exceed 5MB total limit");
        filesToWrite.push({ name, data });
      }
    }

    if (!projectJson) throw new Error("ZIP must contain project.json");

    // ---------------- validate platform ID ----------------
    const langId = req.body.langId || projectJson.lang_id;
    if (!langId || !langs.find((l) => l.id === langId))
      throw new Error("Invalid or missing platform ID");

    // ---------------- generate new project ID ----------------
    counter += 1n;
    const projectId = counter.toString();
    await db.put(COUNTER_KEY, projectId);

    // ---------------- store project metadata ----------------
    const projectData = {
      id: projectId,
      name: req.body.projectName || projectJson.name || "Untitled",
      description: req.body.projectDescription || "",
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
    if (recentProjects.length > 20) {
      recentProjects = recentProjects.slice(-20); // keep only last 20
    }

    await db.put(LAST_PROJECTS_KEY, recentProjects);

    // ---------------- write project files ----------------
    const projectPath = path.join(projectsDir, projectId);
    await fs.mkdir(projectPath, { recursive: true });

    for (const file of filesToWrite) {
      await fs.writeFile(path.join(projectPath, file.name), file.data);
    }

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
