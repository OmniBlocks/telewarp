const express = require("express");
const path = require("path");
const ejs = require("ejs");

const app = express();
const PORT = process.env.PORT || 3000;

// === View engine setup ===
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// === Middleware ===
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('trust proxy', true);
app.set('x-powered-by', false);

// Serve static files from ./static
app.use(express.static(path.join(__dirname, "static")));
app.use("/js", express.static(path.join(__dirname, "frontend-js")));

// === Helper function ===
const fs = require("fs");
const MarkdownIt = require("markdown-it");

app.use((req, res, next) => {
  res.renderWithLayout = async (viewName, options = {}) => {
    try {
      let bodyHtml = "";

      // === Check for Markdown file first ===
      const mdPath = path.join(__dirname, "views", viewName + ".md");
      if (fs.existsSync(mdPath)) {
        const mdContent = fs.readFileSync(mdPath, "utf8");
        const md = new MarkdownIt();
        bodyHtml = `<div class="page">${md.render(mdContent)}</div>`;
      } else {
        // === Fallback to EJS child template ===
        bodyHtml = await ejs.renderFile(
          path.join(__dirname, "views", viewName + ".ejs"),
          options
        );
      }

      // === Render layout, inject the bodyHtml ===
      res.render("layout", { ...options, body: bodyHtml });
    } catch (err) {
      next(err);
    }
  };

  next();
});

// === Routes ===
app.use(
  "/styles/modern-normalize.css",
  express.static(
    require.resolve("modern-normalize/modern-normalize.css")
  )
);

const walkViews = (dir, baseRoute = "") => {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    // Skip partials and directories starting with '_'
    if (stat.isDirectory()) {
      if (!file.startsWith("partials") && !file.startsWith("_")) {
        walkViews(fullPath, path.join(baseRoute, file));
      }
      return;
    }

    // Only .ejs or .md
    const ext = path.extname(file);
    if (![".ejs", ".md"].includes(ext)) return;

    // Construct route path
    let routePath = path.join(baseRoute, file.replace(ext, ""));

    // Convert SvelteKit-style [param] -> :param
    routePath = routePath.replace(/\[(.+?)\]/g, ":$1");

    // Special case for index -> root of folder
    if (file.replace(ext, "") === "index") {
      routePath = baseRoute || "/";
    } else {
      routePath = "/" + routePath.replace(/\\/g, "/"); // normalize Windows paths
    }

    app.get(routePath, (req, res) => {
      let routeOptions = {};

      // Try to load metadata file
      const metaFile = path.join(dir, file.replace(ext, ".meta.js"));
      if (fs.existsSync(metaFile)) {
        routeOptions = require(metaFile);
      }

      // Merge default options
      const defaultTitle =
        routePath === "/"
          ? "TeleWarp - Share projects"
          : file.replace(ext, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + ' - TeleWarp';

      res.renderWithLayout(file.replace(ext, ""), {
        title: routeOptions.title || defaultTitle,
        params: req.params,
        ...routeOptions, // include any extra metadata
      });
    });
  });
};

const mimeTypes = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".cjs": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".html": "text/html",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
};

app.get("/dep/:module", (req, res) => {
  const moduleName = req.params.module;

  try {
    // Resolve module path
    const resolvedPath = require.resolve(moduleName, { paths: [__dirname] });

    // Determine MIME type
    const ext = path.extname(resolvedPath);
    const mimeType = mimeTypes[ext] || "application/octet-stream";

    // Read file contents
    const content = fs.readFileSync(resolvedPath);

    // Send with correct MIME type
    res.type(mimeType).send(content);
  } catch (err) {
    res.status(404).json({ error: `Module "${moduleName}" not found or could not be read` });
  }
});

// Initialize routes
walkViews(path.join(__dirname, "views"));

// === Start server ===
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
