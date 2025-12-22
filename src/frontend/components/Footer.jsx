import React from 'react'
import { Link } from 'react-router-dom'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-text">
          <p>© {currentYear} TeleWarp — Experimental project sharing.</p>
          <p>This service is not affiliated with or endorsed by Scratch or the Scratch Foundation.</p>
        </div>

        <div className="footer-columns" aria-hidden="false">
          <div className="footer-section">
            <Link to="/about">About</Link>
            <Link to="/faq">FAQ</Link>
          </div>

          <div className="footer-section">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.en.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              License (GPL-3.0)
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer