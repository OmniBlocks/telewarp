const path = require("path");
const fsSync = require("fs");
const {getType} = require("mime");

const PROJECTS_DIR = "telewarp-projects"; // flattened folder

module.exports = async (req, res, _, dirname) => {
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "Missing asset id" });

    const filePath = path.join(dirname, PROJECTS_DIR, id);

    if (!fsSync.existsSync(filePath)) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Set correct MIME type
    const type = getType(filePath) || "application/octet-stream";
    res.type(type);

    // Allow CORS (in case frontend fetch is cross-origin)
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Stream the file
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch asset" });
  }
};
