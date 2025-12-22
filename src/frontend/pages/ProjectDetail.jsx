import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProject()
  }, [id])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/project?id=${id}`)
      if (!response.ok) {
        throw new Error('Project not found')
      }
      const data = await response.json()
      setProject(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="page"><p>Loading project...</p></div>
  }

  if (error) {
    return <div className="page"><p>Error: {error}</p></div>
  }

  return (
    <div className="page">
      <h1>{project?.name || 'Project'}</h1>
      <p>{project?.description || 'No description available.'}</p>
    </div>
  )
}

export default ProjectDetail
