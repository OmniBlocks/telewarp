import React, { useState, useEffect } from 'react'

function Terms() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchContent()
  }, [])

  const fetchContent = async () => {
    try {
      const response = await fetch('/api/page/terms')
      if (!response.ok) throw new Error('Failed to fetch content')
      const data = await response.json()
      setContent(data.content || '')
    } catch (err) {
      console.error('Error fetching Terms content:', err)
      setContent('<p>Failed to load Terms of Service content.</p>')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="page"><p>Loading...</p></div>
  }

  return (
    <div 
      className="page" 
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}

export default Terms