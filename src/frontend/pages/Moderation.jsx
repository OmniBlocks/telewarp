import React, { useState, useEffect } from 'react'

function Moderation() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/moderation/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (err) {
      console.error('Error fetching projects:', err)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const sendAction = async (projectId, action) => {
    try {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action })
      })
      
      const data = await response.json()
      
      if (data.success) {
        fetchProjects() // Reload the projects
      } else {
        alert(data.error || 'Failed')
      }
    } catch (err) {
      console.error('Moderation action failed:', err)
      alert('Action failed')
    }
  }

  const handleFlag = (projectId) => {
    sendAction(projectId, 'flag')
  }

  const handleDelete = (projectId) => {
    if (confirm('Are you sure you want to delete this project?')) {
      sendAction(projectId, 'delete')
    }
  }

  if (loading) {
    return <div className="page"><p>Loading...</p></div>
  }

  if (error) {
    return <div className="page"><p>{error}</p></div>
  }

  return (
    <div className="page">
      <h1>With great power comes great responsibility</h1>
      <p>If you are not a moderator, please file a vulnerability on GitHub and explain how you got here.</p>

      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>Project ID</th>
            <th>Name</th>
            <th>Platform</th>
            <th>Created At</th>
            <th>Flagged</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(project => (
            <tr key={project.id} data-id={project.id}>
              <td>{project.id}</td>
              <td>{project.name}</td>
              <td>{project.lang_id}</td>
              <td>{new Date(project.created_at).toLocaleString()}</td>
              <td>{project.flagged ? "Yes" : "No"}</td>
              <td>
                <button 
                  className="flag-btn"
                  onClick={() => handleFlag(project.id)}
                >
                  Flag
                </button>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(project.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Moderation