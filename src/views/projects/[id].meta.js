module.exports = async function(params, _req, db) {
  const projectId = params.id;

  try {
    const project = await db.get(`project:${projectId}`);
    return {
      project,
      title: (project.name || "Project") + " on TeleWarp",
      error: false,
      platforms: require("../../langs.json")
    };
  } catch (e) {
    console.error(`Failed to load project ${projectId}:`, e.message);
    return {
      project: null,
      title: "Error - TeleWarp",
      error: true,
      platforms: null,
      platforms: require("../../langs.json")
    };
  }
};
