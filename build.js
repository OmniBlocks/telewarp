const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const args = process.argv.slice(2)
const isWatch = args.includes('--watch')
const isDev = args.includes('--dev')
const isProd = process.env.NODE_ENV === 'production'

let serverProcess = null

// Build directories
const frontendBuildDir = path.join(__dirname, 'src', 'static', 'dist')
const serverBuildDir = path.join(__dirname, 'dist')

if (!fs.existsSync(frontendBuildDir)) {
  fs.mkdirSync(frontendBuildDir, { recursive: true })
}
if (!fs.existsSync(serverBuildDir)) {
  fs.mkdirSync(serverBuildDir, { recursive: true })
}

// Copy markdown files to frontend assets
function copyMarkdownFiles() {
  const markdownDir = path.join(__dirname, 'src', 'frontend', 'assets', 'markdown')
  if (!fs.existsSync(markdownDir)) {
    fs.mkdirSync(markdownDir, { recursive: true })
  }
  
  const markdownSources = [
    { src: 'src/views/faq/page.md', dest: 'faq.md' },
    { src: 'src/views/terms/page.md', dest: 'terms.md' },
    { src: 'src/views/privacy/page.md', dest: 'privacy.md' },
    { src: 'src/views/userscript/page.md', dest: 'userscript.md' }
  ]
  
  markdownSources.forEach(({ src, dest }) => {
    const srcPath = path.join(__dirname, src)
    const destPath = path.join(markdownDir, dest)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
      console.log(`📄 Copied ${src} → ${dest}`)
    }
  })
}

function startServer() {
  if (serverProcess) {
    console.log('🔄 Restarting server...')
    serverProcess.kill()
  }
  
  serverProcess = spawn('node', [path.join(serverBuildDir, 'index.js')], {
    stdio: 'inherit',
    env: { ...process.env, DEVELOPMENT: 'YES' }
  })
  
  serverProcess.on('error', (err) => {
    console.error('❌ Server process error:', err)
  })
}

async function build() {
  console.log('🚀 Starting unified build process...')
  
  // Copy markdown files first
  copyMarkdownFiles()
  
  // Frontend configuration
  const frontendConfig = {
    entryPoints: [path.join(__dirname, 'src', 'frontend', 'index.jsx')],
    bundle: true,
    outdir: frontendBuildDir,
    format: 'esm',
    target: 'es2020',
    loader: {
      '.js': 'jsx',
      '.jsx': 'jsx',
      '.scss': 'css',
      '.css': 'css',
      '.md': 'text',
      '.png': 'file',
      '.jpg': 'file',
      '.jpeg': 'file',
      '.gif': 'file',
      '.svg': 'file',
    },
    minify: isProd,
    sourcemap: !isProd,
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    metafile: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    },
  }
  
  // Server configuration
  const serverConfig = {
    entryPoints: [path.join(__dirname, 'src', 'index.js')],
    bundle: true,
    outdir: serverBuildDir,
    format: 'cjs',
    target: 'node18',
    platform: 'node',
    external: ['classic-level'],
    minify: isProd,
    sourcemap: !isProd,
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    },
  }
  
  try {
    if (isWatch) {
      // Watch mode for development
      const ctx = await esbuild.context(frontendConfig)
      await ctx.watch()
      console.log('👀 Watching frontend for changes...')
      
      if (isDev) {
        // Also build and watch server in dev mode
        await esbuild.build(serverConfig)
        console.log('✅ Initial server build completed')
        
        startServer()
        
        const serverCtx = await esbuild.context({
          ...serverConfig,
          plugins: [{
            name: 'restart-server',
            setup(build) {
              build.onEnd(() => {
                startServer()
              })
            }
          }]
        })
        await serverCtx.watch()
        console.log('👀 Watching server for changes...')
      }
    } else {
      // Production build
      const [frontendResult] = await Promise.all([
        esbuild.build(frontendConfig),
        esbuild.build(serverConfig)
      ])
      
      console.log('✅ Frontend and server builds completed successfully')
      
      // Generate manifest
      const manifest = {}
      if (frontendResult.metafile) {
        for (const [output, info] of Object.entries(frontendResult.metafile.outputs)) {
          const relativePath = path.relative(frontendBuildDir, output)
          if (relativePath.endsWith('.js') && info.entryPoint) {
            const entryName = path.basename(info.entryPoint, path.extname(info.entryPoint))
            manifest[entryName] = relativePath
          }
        }
      }
      
      fs.writeFileSync(
        path.join(frontendBuildDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      )
    }
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('
  if (serverProcess) {
    serverProcess.kill()
  }
  process.exit(0)
})

build().catch(console.error)
