const path = require("path");
const fsSync = require("fs");
const fs = require("fs/promises");
const AdmZip = require("adm-zip");

const PROJECTS_DIR = "telewarp-projects";

module.exports = async (req, res, db, dirname) => {
  try {
    const projectId = req.query.id;
    if (!projectId) return res.status(400).json({ error: "Missing project id" });

    // ---------------- Fetch project metadata ----------------
    let projectData;
    try {
      projectData = await db.get(`project:${projectId}`);
    } catch {
      return res.status(404).json({ error: "Project not found" });
    }

    const zip = new AdmZip();

    // Add project.json
    const projectJson = JSON.stringify(projectData.metadata, null, 2);
    zip.addFile("project.json", Buffer.from(projectJson, "utf8"));

    // ---------------- Add assets ----------------
    const projectFolder = path.join(dirname, PROJECTS_DIR);
    const allFiles = fsSync.readdirSync(projectFolder);

    // Include all files that start with the projectId (or however you identify assets)
    for (const fileName of allFiles) {
      const filePath = path.join(projectFolder, fileName);
      if (!fsSync.statSync(filePath).isFile()) continue;

      // Optionally filter: only include files that belong to this project
      if (!fileName.startsWith(projectId)) continue;

      const buffer = await fs.readFile(filePath);
      zip.addFile(fileName, buffer);
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="project_${projectId}.zip"`);
    res.setHeader("Content-Length", zipBuffer.length);
    res.send(zipBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create project ZIP" });
  }
};
