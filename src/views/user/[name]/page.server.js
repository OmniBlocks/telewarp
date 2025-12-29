// Remove 'res' from here
module.exports = async function(params, req, db) { 
  const username = params.name;
  
  if (!username) {
    return { error: 'invalid_params', title: "Error - TeleWarp" };
  }

  try {
    // 1. Fetch User Data
    let userData;
    try {
      userData = await db.get(`user:${username.toLowerCase()}`);
    } catch (e) {
      return {
        userData: null,
        userProjects: [],
        title: "User Not Found - TeleWarp",
        user: req.user,
        error: 'not_found'
      };
    }

    // 2. Fetch User's Projects
    const userProjects = [];
    const recentIds = await db.get("projects:recent").catch(() => []);
    
    for (const id of recentIds) {
      try {
        const p = await db.get(`project:${id}`);
        // Ensure both author and username exist before comparing
        if (p && p.author && userData.username && 
            p.author.toLowerCase() === userData.username.toLowerCase()) {
          userProjects.push(p);
        }
      } catch (e) { /* skip missing */ }
    }

    // Map avatarUrl for the EJS template
    userData.avatarUrl = `/api/user-api?action=get&user=${userData.username}&type=image`;

    return {
      userData,
      userProjects,
      title: `${userData.username} on TeleWarp`,
      user: req.user,
      error: false
    };

  } catch (e) {
    console.error(`Failed to load user ${username}:`, e);
    return {
      userData: null,
      userProjects: [],
      title: "Error - TeleWarp",
      user: req.user,
      error: 'generic'
    };
  }
};