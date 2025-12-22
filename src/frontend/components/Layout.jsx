import React, { useEffect, useState } from 'react'
import Header from './Header'
import Footer from './Footer'

function Layout({ children, contentOnly = false, title = 'TeleWarp - Share projects' }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    // Set document title
    document.title = title

    // Initialize theme
    let savedTheme = localStorage.getItem('theme')
    
    if (!savedTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      savedTheme = prefersDark ? 'dark' : 'light'
    }
    
    setTheme(savedTheme)
    applyTheme(savedTheme)
  }, [title])

  const applyTheme = (newTheme) => {
    if (newTheme === 'dark') {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  if (contentOnly) {
    return <main>{children}</main>
  }

  return (
    <>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <div className="page-container">
        <div className="news">TeleWarp is in an alpha stage and may break at any time.</div>
        <main>{children}</main>
        <Footer />
      </div>
    </>
  )
}

export default Layout