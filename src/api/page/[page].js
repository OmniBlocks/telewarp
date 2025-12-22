const fs = require('fs')
const path = require('path')
const MarkdownIt = require('markdown-it')

module.exports = function(req, res) {
  const pageName = req.params.page
  const mdPath = path.join(__dirname, '../../views', pageName, 'page.md')
  
  if (!fs.existsSync(mdPath)) {
    return res.status(404).json({ error: 'Page not found' })
  }
  
  try {
    const md = new MarkdownIt()
    const markdownContent = fs.readFileSync(mdPath, 'utf8')
    const htmlContent = md.render(markdownContent)
    
    res.json({
      content: htmlContent
    })
  } catch (err) {
    console.error('Error rendering markdown:', err)
    res.status(500).json({ error: 'Failed to render page content' })
  }
}