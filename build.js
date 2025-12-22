const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const isWatch = process.argv.includes('--watch')
const isProd = process.env.NODE_ENV === 'production'

// Ensure build directory exists
const buildDir = path.join(__dirname, 'src', 'static', 'dist')
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true })
}

const config = {
  entryPoints: [path.join(__dirname, 'src', 'frontend', 'index.jsx')],
  bundle: true,
  outdir: buildDir,
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

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(config)
      await ctx.watch()
      console.log('👀 Watching for changes...')
    } else {
      const result = await esbuild.build(config)
      console.log('✅ Build completed successfully')
      
      // Write manifest file for the server to know about generated files
      const manifest = {}
      if (result.metafile) {
        for (const [output, info] of Object.entries(result.metafile.outputs)) {
          const relativePath = path.relative(buildDir, output)
          if (relativePath.endsWith('.js') && info.entryPoint) {
            const entryName = path.basename(info.entryPoint, path.extname(info.entryPoint))
            manifest[entryName] = relativePath
          }
        }
      }
      
      fs.writeFileSync(
        path.join(buildDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      )
    }
  } catch (error) {
    console.error('❌ Build failed:', error)
    process.exit(1)
  }
}

build()