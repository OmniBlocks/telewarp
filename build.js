const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const args = process.argv.slice(2)
const isWatch = args.includes('--watch')
const isServer = args.includes('--server')
const isDev = args.includes('--dev')
const isProd = process.env.NODE_ENV === 'production'

let serverProcess = null

// Frontend build configuration
const frontendBuildDir = path.join(__dirname, 'src', 'static', 'dist')
if (!fs.existsSync(frontendBuildDir)) {
  fs.mkdirSync(frontendBuildDir, { recursive: true })
}

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

// Server build configuration
const serverBuildDir = path.join(__dirname, 'dist')
if (!fs.existsSync(serverBuildDir)) {
  fs.mkdirSync(serverBuildDir, { recursive: true })
}

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

async function buildFrontend() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(frontendConfig)
      await ctx.watch()
      console.log('👀 Watching frontend for changes...')
      return ctx
    } else {
      const result = await esbuild.build(frontendConfig)
      console.log('✅ Frontend build completed successfully')
      
      // Write manifest file for the server to know about generated files
      const manifest = {}
      if (result.metafile) {
        for (const [output, info] of Object.entries(result.metafile.outputs)) {
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
      return result
    }
  } catch (error) {
    console.error('❌ Frontend build failed:', error)
    process.exit(1)
  }
}

async function buildServer() {
  try {
    if (isWatch) {
      // Build server first
      await esbuild.build(serverConfig)
      console.log('✅ Initial server build completed')
      
      // Start server
      startServer()
      
      // Set up watching with custom plugin for restart
      const ctx = await esbuild.context({
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
      await ctx.watch()
      console.log('👀 Watching server for changes...')
      
      return ctx
    } else {
      const result = await esbuild.build(serverConfig)
      console.log('✅ Server build completed successfully')
      return result
    }
  } catch (error) {
    console.error('❌ Server build failed:', error)
    process.exit(1)
  }
}

async function main() {
  if (isDev) {
    // Development mode: build and watch both frontend and server
    console.log('🚀 Starting development mode with hot reload...')
    await buildFrontend()
    await buildServer()
  } else if (isServer) {
    // Server only
    await buildServer()
  } else {
    // Frontend only (default)
    await buildFrontend()
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

main().catch(console.error)
