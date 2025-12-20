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

app.use(
  "/modern-normalize.css",
  express.static(
    require.resolve("modern-normalize/modern-normalize.css")
  )
);

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
app.get("/", (req, res) => {
  res.renderWithLayout("index", {
    title: "TeleWarp - Share projects"
  });
});

app.get("/about", (req, res) => {
  res.renderWithLayout("about", {
    title: "About - TeleWarp",
    platforms: require("./langs.json")
  });
});

app.get("/terms", (req, res) => {
  res.renderWithLayout("terms", {
    title: "Terms of Service"
  });
});

app.get("/upload", (req, res) => {
  res.renderWithLayout("upload", {
    title: "Upload - TeleWarp",
    platforms: require("./langs.json")
  });
});

app.use(
  "/styles/modern-normalize.css",
  express.static(
    require.resolve("modern-normalize/modern-normalize.css")
  )
);

// === Start server ===
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
