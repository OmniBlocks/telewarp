import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function Home() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects/recent')
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      const data = await response.json()
      setProjects(data.projects || [])
      setError(data.error)
    } catch (err) {
      setError('Failed to load projects')
      console.error('Error fetching projects:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="hero">
          <h1>TeleWarp Projects</h1>
        </div>
        <div className="page">
          <p>Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="hero">
        <h1>TeleWarp Projects</h1>
      </div>

      <div className="page">
        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}
        
        {projects && projects.length > 0 ? (
          <div className="row">
            <h2>Recent</h2>
            <div className="projects-row">
              {projects.map(project => (
                <Link 
                  key={project.id} 
                  to={`/projects/${project.id}`} 
                  className="project-card"
                >
                  {project.thumbnail ? (
                    <img 
                      src={`/api/asset?id=thumb_${project.id}.png`} 
                      alt={project.name} 
                      className="project-thumb" 
                    />
                  ) : (
                    <img 
                      src="/images/default-thumbnail.png" 
                      alt={project.name} 
                      className="project-thumb" 
                    />
                  )}
                  <div className="project-name">{project.name}</div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p>No projects found.</p>
        )}
      </div>
    </div>
  )
}

export default Home