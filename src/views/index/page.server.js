module.exports = async function(_, __, db) {
  const DEFAULT_TITLE = "TeleWarp - Share projects";
  
  try {
    // 1. Fetch recent IDs and ensure we have an array
    const rawIds = await db.get("projects:recent").catch(() => []);
    const recentIds = Array.isArray(rawIds) ? rawIds : [];

    // 2. Limit to the last 20 IDs before mapping to save resources
    const targetIds = recentIds.slice(-20);

    // 3. Fetch projects in parallel
    const projectResults = await Promise.all(
      targetIds.map(async (id) => {
        try {
          const project = await db.get(`project:${id}`);
          return project || null; // Ensure undefined becomes null for filtering
        } catch (err) {
          // Log specific failed IDs for debugging
          console.warn(`Missing or failed project lookup for ID: ${id}`);
          return null;
        }
      })
    );

    // 4. Filter out nulls and reverse
    // The filter(Boolean) handles both null and undefined results
    const projects = projectResults.filter(Boolean).reverse();

    return {
      projects,
      title: DEFAULT_TITLE,
      error: null,
    };
  } catch (err) {
    console.error("Critical failure in project loader:", err.message);
    return {
      projects: [],
      title: DEFAULT_TITLE,
      error: "An internal error occurred while loading projects.",
    };
  }
};