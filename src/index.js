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

function compileMergedStyles(pageScssPath) {
  let css = ''

  // 1️⃣ modern-normalize first
  if (fs.existsSync(modernNormalizePath)) {
    const normalizeCss = fs.readFileSync(modernNormalizePath, 'utf8')
    css += `@layer normalize {\n${normalizeCss}\n}\n`
  }

  // 2️⃣ layout.scss
  if (fs.existsSync(layoutScssPath)) {
    const layout = sass.compile(layoutScssPath, { style: 'expanded' })
    css += `@layer layout {\n${layout.css}\n}\n`
  }

  // 3️⃣ page.scss
  if (pageScssPath && fs.existsSync(pageScssPath)) {
    const page = sass.compile(pageScssPath, { style: 'expanded' })
    css += `@layer page {\n${page.css}\n}\n`
  }

  if (!css.trim()) return ''

  // 4️⃣ single minify pass
  return `<style>${isProd ? csso.minify(css).css : css}</style>`
}

/* =========================
   DATABASE
   ========================= */

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

/* =========================
   VIEW ENGINE
   ========================= */

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

/* =========================
   MIDDLEWARE
   ========================= */

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.set('trust proxy', true)
app.set('x-powered-by', false)

app.use(express.static(path.join(__dirname, 'static')))
app.use('/js', express.static(path.join(__dirname, 'frontend-js')))

/* =========================
   renderWithLayout helper
   ========================= */

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

/* =========================
   VIEW ROUTES LOADER
   ========================= */

function walkViews(dir, baseRoute = '') {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = fs.statSync(fullPath)

    if (!stat.isDirectory()) continue
    if (entry.startsWith('_') || entry.startsWith('partials')) continue

    // Route segment (supports [id] → :id)
    let segment = entry.replace(/\[(.+?)\]/g, ':$1')
    let nextBaseRoute = entry === 'index' ? baseRoute : path.join(baseRoute, segment)

    let routePath = nextBaseRoute === '' ? '/' : '/' + nextBaseRoute.replace(/\\/g, '/')

    const ejsFile = path.join(fullPath, 'page.ejs')
    const serverFile = path.join(fullPath, 'page.server.js')
    const scssFile = path.join(fullPath, 'page.scss')

    // ✅ Register route ONLY if page exists
    if (fs.existsSync(ejsFile) || fs.existsSync(serverFile)) {
      app.get(routePath, async (req, res, next) => {
        try {
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

          const styleTag = compileMergedStyles(scssFile)

          const title =
            routeOptions.title ||
            (routePath === '/'
              ? 'TeleWarp - Share projects'
              : entry.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) +
                ' - TeleWarp')

          res.render('layout', {
            body: bodyHtml,
            styleTag,
            isProd,
            title,
            contentOnly: routeOptions.contentOnly ?? false,
            params: req.params,
            ...routeOptions,
          })
        } catch (err) {
          next(err)
        }
      })
    }

    // ✅ ALWAYS recurse (this is the real fix)
    walkViews(fullPath, nextBaseRoute)
  }
}

/* =========================
   API ROUTES LOADER
   ========================= */

const walkApi = (dir, baseRoute = '') => {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      if (!file.startsWith('_')) {
        walkApi(fullPath, path.join(baseRoute, file))
      }
      continue
    }

    if (path.extname(file) !== '.js') continue

    let routePath = path.join(baseRoute, file.replace('.js', ''))
    routePath = routePath.replace(/\[(.+?)\]/g, ':$1')

    if (file.replace('.js', '') === 'index') {
      routePath = baseRoute || '/'
    } else {
      routePath = '/' + routePath.replace(/\\/g, '/')
    }

    app.all('/api' + routePath, async (req, res, next) => {
      try {
        delete require.cache[require.resolve(fullPath)]
        const handler = require(fullPath)
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        // Handle preflight
        if (req.method === 'OPTIONS') {
          return res.sendStatus(200)
        }

        if (typeof handler === 'function') {
          await handler(req, res, db, __dirname)
        } else {
          res.status(500).json({ error: 'API module does not export a function' })
        }
      } catch (err) {
        next(err)
      }
    })
  }
}

/* =========================
   DEP LOADER
   ========================= */

const mimeTypes = {
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
}

/* =========================
   INIT + START
   ========================= */

walkApi(path.join(__dirname, 'api'))
walkViews(path.join(__dirname, 'views'))

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
})
