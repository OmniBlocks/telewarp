module.exports = async function (params, _req, db) {
  const projectId = params.id
  const platforms = require('../../../../langs.json')

  try {
    const project = await db.get(`project:${projectId}`)

    if (!project) {
      // Project does not exist
      return {
        project: null,
        title: 'Project Not Found - TeleWarp',
        error: 'not found',
        platforms,
        contentOnly: true,
      }
    }

    return {
      project,
      title: (project.name || 'Project') + ' on TeleWarp',
      error: false,
      platforms,
      contentOnly: true,
    }
  } catch (e) {
    console.error(`Failed to load project ${projectId}:`, e.message)
    return {
      project: null,
      title: 'Error - TeleWarp',
      error: 'generic',
      platforms,
      contentOnly: true,
    }
  }
}
