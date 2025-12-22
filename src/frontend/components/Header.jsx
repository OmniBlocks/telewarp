import React from 'react'
import { Link } from 'react-router-dom'

function Header({ theme, onToggleTheme }) {
  const themeIcon = theme === 'dark' ? '/images/tw-sun.svg' : '/images/tw-moon.svg'

  return (
    <header className="header">
      <div>
        <Link className="link" to="/">
          <img src="/images/logo.svg" height="32" alt="TeleWarp" />
        </Link>
        <Link className="link" to="/upload">Upload</Link>
      </div>
      <div>
        <button className="link" onClick={onToggleTheme}>
          <img src={themeIcon} height="24" alt="Toggle theme" />
        </button>
      </div>
    </header>
  )
}

export default Header