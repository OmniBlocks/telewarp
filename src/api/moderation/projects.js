module.exports = async (req, res, db) => {
  try {
    // Fetch last 50 projects for moderation
    const projects = [];
    for await (const [key, value] of db.iterator({ gt: "project:", lt: "project;"})) {
      projects.push(value);
    }

    projects.sort((a, b) => b.created_at - a.created_at);

    res.json({ 
      projects: projects.slice(0, 50) 
    });
  } catch (err) {
    console.error('Error fetching moderation projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};