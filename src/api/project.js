module.exports = async (req, res, db, _) => {
  try {
    const projectId = req.query.id;
    if (!projectId) return res.status(400).json({ error: "Missing project id" });

    // fetch project metadata from DB
    let projectData;
    try {
      projectData = await db.get(`project:${projectId}`);
    } catch {
      return res.status(404).json({ error: "Project not found" });
    }

    // return the project.json content
    res.json(projectData.metadata);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch project.json" });
  }
};
