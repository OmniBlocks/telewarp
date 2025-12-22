import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

function Upload() {
  const navigate = useNavigate()
  const [platforms, setPlatforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null)
  const [projectInfo, setProjectInfo] = useState({
    name: '',
    platform: '',
    langId: '',
    description: ''
  })
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const fileInputRef = useRef(null)
  const scaffoldingRef = useRef(null)
  const capturedThumbnailRef = useRef(null)

  useEffect(() => {
    fetchPlatforms()
    initializeScaffolding()
  }, [])

  const fetchPlatforms = async () => {
    try {
      const response = await fetch('/api/platforms')
      if (!response.ok) throw new Error('Failed to fetch platforms')
      const data = await response.json()
      setPlatforms(data.platforms || [])
    } catch (err) {
      setError('Failed to load supported platforms')
      console.error('Error fetching platforms:', err)
    } finally {
      setLoading(false)
    }
  }

  const initializeScaffolding = async () => {
    // Wait for Scaffolding to be available
    const checkScaffolding = () => {
      return new Promise((resolve) => {
        const check = () => {
          if (typeof window.Scaffolding !== 'undefined') {
            resolve()
          } else {
            setTimeout(check, 100)
          }
        }
        check()
      })
    }

    try {
      await checkScaffolding()
      
      const scaffolding = new window.Scaffolding.Scaffolding()
      scaffolding.usePackagedRuntime = true
      scaffolding.connectPeripherals = false
      scaffolding.resizeMode = 'stretch'
      scaffolding.setup()
      
      const container = document.querySelector('#sc')
      if (container) {
        scaffolding.appendTo(container)
      }

      scaffolding.setExtensionSecurityManager({
        getSandboxMode: () => 'unsandboxed',
        canLoadExtensionFromProject: url => {
          if (url.startsWith("https://extensions.turbowarp.org/") || 
              url.startsWith("https://omniblocks.github.io/extensions/")) {
            return true
          }
          showError("Cannot generate thumbnail because this project is using untrusted extensions. A placeholder will be shown instead.")
          return false
        }
      })

      scaffoldingRef.current = scaffolding
    } catch (err) {
      console.error('Failed to initialize Scaffolding:', err)
    }
  }

  const showError = (message) => {
    setError(message)
    setTimeout(() => setError(''), 6000)
  }

  const createExtensionMap = () => {
    const map = {}
    platforms.forEach(platform => {
      platform.accept.forEach(ext => {
        const key = ext.replace('.', '')
        map[key] = { id: platform.id, name: platform.name }
      })
    })
    return map
  }

  const handleFileSelect = async (file) => {
    setSelectedFile(file)
    const name = file.name.replace(/\.[^/.]+$/, "")
    const ext = file.name.split(".").pop().toLowerCase()
    
    const extensionMap = createExtensionMap()
    const info = extensionMap[ext]
    
    setProjectInfo({
      name,
      platform: info ? info.name : 'Unknown',
      langId: info ? info.id : '',
      description: ''
    })

    if (!scaffoldingRef.current) {
      showError("Scaffolding not initialized.")
      return
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      await scaffoldingRef.current.loadProject(arrayBuffer)
      await captureThumbnail()
    } catch (err) {
      console.error('Error loading project:', err)
      showError('Failed to load project')
    }
  }

  const captureThumbnail = async () => {
    let canvas = document.querySelector(".sc-canvas")
    const start = Date.now()
    
    while (!canvas && Date.now() - start < 3000) {
      await new Promise(r => setTimeout(r, 50))
      canvas = document.querySelector(".sc-canvas")
    }

    if (!canvas) {
      showError("Failed to capture thumbnail: canvas not found")
      return null
    }

    scaffoldingRef.current.relayout()
    
    const dataUrl = canvas.toDataURL("image/png")
    capturedThumbnailRef.current = dataUrl
    setThumbnailPreview(dataUrl)
    
    return dataUrl
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    
    if (e.dataTransfer.files.length) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files.length) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedFile) {
      showError("Please select a file to upload.")
      return
    }

    setUploading(true)
    
    const formData = new FormData()
    formData.append('projectFile', selectedFile)
    formData.append('projectName', projectInfo.name)
    formData.append('projectDescription', projectInfo.description)
    formData.append('langId', projectInfo.langId)

    if (capturedThumbnailRef.current) {
      try {
        const blob = await (await fetch(capturedThumbnailRef.current)).blob()
        formData.append('thumbnail', blob, 'thumbnail.png')
      } catch (err) {
        console.error('Failed to add thumbnail:', err)
      }
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Upload failed')
      }

      navigate(`/projects/${data.id}`)
    } catch (err) {
      console.error('Upload error:', err)
      showError(err.message || 'Unexpected upload error')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="hero">
          <h1>Upload project</h1>
        </div>
        <div className="page">
          <p>Loading... Make sure to enable JavaScript if you haven't already.</p>
        </div>
      </div>
    )
  }

  const acceptedExtensions = platforms.flatMap(p => p.accept).join(', ')

  return (
    <div>
      <div className="hero">
        <h1>Upload project</h1>
      </div>

      <div className="page">
        {error && (
          <div id="errorPopup" style={{ display: 'block' }}>
            <strong>Upload failed</strong>
            <div style={{ marginTop: '0.5rem' }}>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="upload-form">
          <div 
            className={`file-drop-zone ${dragOver ? 'dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="file-input"
              accept={acceptedExtensions}
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            <p className="file-drop-text">
              {selectedFile ? selectedFile.name : 'Drag & drop a file here or click to select'}
            </p>
          </div>

          <details>
            <summary>Supported programming languages</summary>
            <ul>
              {platforms.map(platform => 
                platform.accept.map(ext => (
                  <li key={`${platform.id}-${ext}`}>
                    {platform.name} ({ext})
                  </li>
                ))
              )}
            </ul>
          </details>

          {selectedFile && (
            <div id="projectInfo">
              <h1>Add information</h1>

              <label htmlFor="projectName">Project Name:</label>
              <input
                type="text"
                id="projectName"
                value={projectInfo.name}
                onChange={(e) => setProjectInfo(prev => ({ ...prev, name: e.target.value }))}
                required
              />
              <br />

              <label>Project Platform:</label>
              <span id="projectPlatform">{projectInfo.platform}</span>
              <br />

              <label htmlFor="projectDescription">Project Notes:</label>
              <textarea
                id="projectDescription"
                value={projectInfo.description}
                onChange={(e) => setProjectInfo(prev => ({ ...prev, description: e.target.value }))}
                rows="4"
              />
              <br />

              <h2>Thumbnail</h2>
              <p>Tip: To change the thumbnail, create a new sprite that hides when the green flag is clicked. Before saving, show that sprite.</p>
              
              <div id="sc" style={{ 
                top: 0, 
                left: 0, 
                position: 'fixed', 
                width: '480px', 
                aspectRatio: '4/3', 
                overflow: 'visible', 
                opacity: 0, 
                pointerEvents: 'none' 
              }}></div>
              
              {thumbnailPreview && (
                <img 
                  id="thumbnailPreview" 
                  src={thumbnailPreview} 
                  alt="Project thumbnail"
                  style={{ display: 'block', maxWidth: '200px' }}
                />
              )}
              
              <p>If something's missing, click "Regenerate Thumbnail". Note that thumbnails for projects with untrusted extensions are not generated for security reasons.</p>
              
              <button 
                type="button" 
                onClick={captureThumbnail}
                disabled={!selectedFile}
              >
                Regenerate Thumbnail
              </button>
              <br />
              
              <button type="submit" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Load Scaffolding script */}
      <script src="/scaffolding-ob.js" defer></script>
    </div>
  )
}

export default Upload