module.exports = async function(_, __, db) {
  try {
    // fetch the last 20 project IDs
    const recentIds = await db.get("projects:recent").catch(() => []);

    // fetch the corresponding projects in parallel
    const projects = await Promise.all(
      recentIds.map((id) => db.get(`project:${id}`).catch(() => null))
    );

    return {
      projects: projects.filter((p) => p !== null), // filter out any missing
      title: "TeleWarp - Share projects",
      error: null,
    };
  } catch (err) {
    console.error("Failed to load projects:", err.message);
    return {
      projects: [],
      title: "TeleWarp - Share projects",
      error: err.message || "Unknown error",
    };
  }
};
