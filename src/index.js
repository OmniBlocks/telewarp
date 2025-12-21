const express = require('express')
const path = require('path')
const ejs = require('ejs')
const fs = require('fs')
const sass = require('sass')
const csso = require('csso')
const MarkdownIt = require('markdown-it')
const { ClassicLevel } = require('classic-level')

const app = express()
const PORT = process.env.PORT || 3000
const isProd = !Boolean(process.env.DEVELOPMENT)

const layoutScssPath = path.join(__dirname, 'views', 'layout.scss')
const modernNormalizePath = require.resolve('modern-normalize/modern-normalize.css')

// =========================
// Compile merged styles (normalize + layout + page)
function compileMergedStyles(pageScssPath) {
  let css = ''

  if (fs.existsSync(modernNormalizePath)) {
    const normalizeCss = fs.readFileSync(modernNormalizePath, 'utf8')
    css += `@layer normalize {\n${normalizeCss}\n}\n`
  }

  if (fs.existsSync(layoutScssPath)) {
    const layout = sass.compile(layoutScssPath, { style: 'expanded' })
    css += `@layer layout {\n${layout.css}\n}\n`
  }

  if (pageScssPath && fs.existsSync(pageScssPath)) {
    const page = sass.compile(pageScssPath, { style: 'expanded' })
    css += `@layer page {\n${page.css}\n}\n`
  }

  if (!css.trim()) return ''

  return isProd ? csso.minify(css).css : css
}

// =========================
// Database
const dbPath = path.join(__dirname, 'leveldb')
const db = new ClassicLevel(dbPath, { valueEncoding: 'json' })

;(async () => {
  try {
    await db.open()
    console.log('✔ Database opened')
  } catch (err) {
    console.error('✖ Failed to open database:', err)
    process.exit(1)
  }
})()

app.locals.db = db

// =========================
// View engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// =========================
// Middleware
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.set('trust proxy', true)
app.set('x-powered-by', false)

app.use(express.static(path.join(__dirname, 'static')))
app.use('/js', express.static(path.join(__dirname, 'frontend-js')))

// =========================
// In-memory caches
const cache = {} // { routePath: { html, stylePath, title } }
const cssCache = {} // { viewName: compiledCSS }

// =========================
// renderWithLayout helper (dev)
app.use((req, res, next) => {
  res.renderWithLayout = async (viewName, options = {}) => {
    try {
      let bodyHtml = ''
      const mdPath = path.join(__dirname, 'views', viewName + '.md')

      if (fs.existsSync(mdPath)) {
        const md = new MarkdownIt()
        bodyHtml = `<div class="page">${md.render(fs.readFileSync(mdPath, 'utf8'))}</div>`
      } else {
        bodyHtml = await ejs.renderFile(path.join(__dirname, 'views', viewName + '.ejs'), options)
      }

      res.render('layout', { ...options, body: bodyHtml })
    } catch (err) {
      next(err)
    }
  }
  next()
})

// =========================
// Serve in-memory CSS
app.get('/css/:viewName.css', (req, res) => {
  const css = cssCache[req.params.viewName]
  if (!css) return res.sendStatus(404)
  res.type('text/css').send(css)
})

// =========================
// Pre-render views
async function preRenderViews(dir, baseRoute = '') {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)

    if (!stat.isDirectory()) continue
    if (entry.startsWith('_') || entry.startsWith('partials')) continue

    const segment = entry.replace(/\[(.+?)\]/g, ':$1')
    const nextBaseRoute = entry === 'index' ? baseRoute : path.join(baseRoute, segment)
    const routePath = nextBaseRoute === '' ? '/' : '/' + nextBaseRoute.replace(/\\/g, '/')

    // Skip / and /projects/*
    if (routePath === '/' || routePath.startsWith('/projects/')) {
      await preRenderViews(fullPath, nextBaseRoute)
      continue
    }

    const ejsFile = path.join(fullPath, 'page.ejs')
    const serverFile = path.join(fullPath, 'page.server.js')
    const scssFile = path.join(fullPath, 'page.scss')
    const mdFile = path.join(fullPath, 'page.md')

    if (fs.existsSync(ejsFile) || fs.existsSync(serverFile) || fs.existsSync(mdFile)) {
      let routeOptions = {}
      if (fs.existsSync(serverFile)) {
        delete require.cache[require.resolve(serverFile)]
        const mod = require(serverFile)
        routeOptions = typeof mod === 'function' ? await mod({}, null, db) : mod
      }

      // Pre-render HTML
      let bodyHtml = ''
      if (fs.existsSync(mdFile)) {
        const md = new MarkdownIt()
        bodyHtml = `<div class="page">${md.render(fs.readFileSync(mdFile, 'utf8'))}</div>`
      } else if (fs.existsSync(ejsFile)) {
        bodyHtml = await ejs.renderFile(ejsFile, { params: {}, ...routeOptions })
      }

      // Pre-compile CSS in memory
      if (isProd) {
        const css = compileMergedStyles(scssFile)
        cssCache[entry] = css
      }

      const title =
        routeOptions.title ||
        entry.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' - TeleWarp'

      // Cache the pre-rendered HTML and style
      cache[routePath] = { html: bodyHtml, stylePath: `/css/${entry}.css`, title, ...routeOptions }
    }

    await preRenderViews(fullPath, nextBaseRoute)
  }
}

// =========================
// Route handler
function createRouteHandler(routePath, ejsFile, serverFile, scssFile) {
  return async (req, res, next) => {
    try {
      // Serve cached pre-rendered page
      if (isProd && cache[routePath]) {
        const cached = cache[routePath]
        return res.render('layout', {
          body: cached.html,
          styleTag: cached.stylePath ? `<link rel="stylesheet" href="${cached.stylePath}">` : '',
          title: cached.title,
          params: req.params,
          ...cached,
        })
      }

      // DEV: render on-the-fly
      let routeOptions = {}
      if (fs.existsSync(serverFile)) {
        delete require.cache[require.resolve(serverFile)]
        const mod = require(serverFile)
        routeOptions = typeof mod === 'function' ? await mod(req.params, req, db) : mod
      }

      let bodyHtml = ''
      if (fs.existsSync(ejsFile)) {
        bodyHtml = await ejs.renderFile(ejsFile, {
          params: req.params,
          ...routeOptions,
        })
      }

      const styleTag = `<style>${compileMergedStyles(scssFile)}</style>`
      const title =
        routeOptions.title ||
        path
          .basename(routePath)
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()) + ' - TeleWarp'

      res.render('layout', { body: bodyHtml, styleTag, title, params: req.params, ...routeOptions })
    } catch (err) {
      next(err)
    }
  }
}

// =========================
// Walk views and register routes
function walkViewsForRoutes(dir, baseRoute = '') {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)
    if (!stat.isDirectory()) continue
    if (entry.startsWith('_') || entry.startsWith('partials')) continue

    const segment = entry.replace(/\[(.+?)\]/g, ':$1')
    const nextBaseRoute = entry === 'index' ? baseRoute : path.join(baseRoute, segment)
    const routePath = nextBaseRoute === '' ? '/' : '/' + nextBaseRoute.replace(/\\/g, '/')

    const ejsFile = path.join(fullPath, 'page.ejs')
    const serverFile = path.join(fullPath, 'page.server.js')
    const scssFile = path.join(fullPath, 'page.scss')
    const mdFile = path.join(fullPath, 'page.md')

    if (fs.existsSync(ejsFile) || fs.existsSync(serverFile) || fs.existsSync(mdFile)) {
      app.get(routePath, createRouteHandler(routePath, ejsFile, serverFile, scssFile))
    }

    walkViewsForRoutes(fullPath, nextBaseRoute)
  }
}

// =========================
// Walk API routes
const walkApi = (dir, baseRoute = '') => {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      if (!file.startsWith('_')) walkApi(fullPath, path.join(baseRoute, file))
      continue
    }
    if (path.extname(file) !== '.js') continue

    let routePath = path.join(baseRoute, file.replace('.js', ''))
    routePath = routePath.replace(/\[(.+?)\]/g, ':$1')
    if (file.replace('.js', '') === 'index') routePath = baseRoute || '/'
    else routePath = '/' + routePath.replace(/\\/g, '/')

    app.all('/api' + routePath, async (req, res, next) => {
      try {
        delete require.cache[require.resolve(fullPath)]
        const handler = require(fullPath)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        if (req.method === 'OPTIONS') return res.sendStatus(200)
        if (typeof handler === 'function') await handler(req, res, db, __dirname)
        else res.status(500).json({ error: 'API module does not export a function' })
      } catch (err) {
        next(err)
      }
    })
  }
}

// =========================
// Start server
;(async () => {
  if (isProd) {
    console.log('⚡ Pre-rendering all views (except / and /projects/*) and compiling CSS...')
    await preRenderViews(path.join(__dirname, 'views'))
    console.log('✔ Pre-rendering complete')
  }

  walkApi(path.join(__dirname, 'api'))
  walkViewsForRoutes(path.join(__dirname, 'views'))

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
  })
})()
