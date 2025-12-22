import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import privacyMarkdown from '../assets/markdown/privacy.md'

function Privacy() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    renderContent()
  }, [])

  const renderContent = async () => {
    try {
      // Configure marked to be safe
      marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false, // We control the markdown content
        smartLists: true,
        smartypants: true
      })
      
      const htmlContent = marked(privacyMarkdown)
      setContent(htmlContent)
    } catch (err) {
      console.error('Error fetching Privacy content:', err)
      setContent('<p>Failed to load Privacy Policy content.</p>')
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

export default Privacy