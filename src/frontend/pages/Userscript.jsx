import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import userscriptMarkdown from '../assets/markdown/userscript.md'

function Userscript() {
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
      
      const htmlContent = marked(userscriptMarkdown)
      setContent(htmlContent)
    } catch (err) {
      console.error('Error fetching Userscript content:', err)
      setContent('<p>Failed to load Userscript content.</p>')
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

export default Userscript