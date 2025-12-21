module.exports = async (req, res, db) => {
  const { action, projectId } = req.body;

  if (!projectId || !["delete", "flag"].includes(action)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  try {
    const project = await db.get(`project:${projectId}`);
    if (!project) return res.status(404).json({ error: "Project not found" });

    if (action === "delete") {
      await db.del(`project:${projectId}`);
      return res.json({ success: true, message: "Project deleted" });
    } else if (action === "flag") {
      project.flagged = true;
      await db.put(`project:${projectId}`, project);
      return res.json({ success: true, message: "Project flagged" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to perform moderation action" });
  }
};
