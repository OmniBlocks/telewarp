module.exports = async (params, req, db) => {
  // Fetch last 50 projects for moderation
  const projects = [];
  for await (const [key, value] of db.iterator({ gt: "project:", lt: "project;"})) {
    projects.push(value);
  }

  projects.sort((a, b) => b.created_at - a.created_at);

  return { title: "Moderation Panel - TeleWarp", projects: projects.slice(0, 50) };
};
