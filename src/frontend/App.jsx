import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Upload from './pages/Upload'
import About from './pages/About'
import FAQ from './pages/FAQ'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Moderation from './pages/Moderation'
import Userscript from './pages/Userscript'
import ProjectDetail from './pages/ProjectDetail'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/moderation" element={<Moderation />} />
        <Route path="/userscript" element={<Userscript />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
      </Routes>
    </Layout>
  )
}

export default App