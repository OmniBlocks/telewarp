const express = require("express");
const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const MarkdownIt = require("markdown-it");
const { ClassicLevel } = require("classic-level");

const app = express();
const PORT = process.env.PORT || 3000;


/* =========================
   DATABASE (GLOBAL, OPEN ONCE)
   ========================= */

const dbPath = path.join(__dirname, "leveldb");
const db = new ClassicLevel(dbPath, { valueEncoding: "json" });

(async () => {
  try {
    await db.open();
    console.log("✔ Database opened");
  } catch (err) {
    console.error("✖ Failed to open database:", err);
    process.exit(1);
  }
})();

// make db available everywhere
app.locals.db = db;

/* =========================
   VIEW ENGINE SETUP
   ========================= */

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* =========================
   MIDDLEWARE
   ========================= */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("trust proxy", true);
app.set("x-powered-by", false);

app.use(express.static(path.join(__dirname, "static")));
app.use("/js", express.static(path.join(__dirname, "frontend-js")));

/* =========================
   renderWithLayout helper
   ========================= */

app.use((req, res, next) => {
  res.renderWithLayout = async (viewName, options = {}) => {
    try {
      let bodyHtml = "";

      const mdPath = path.join(__dirname, "views", viewName + ".md");
      if (fs.existsSync(mdPath)) {
        const md = new MarkdownIt();
        bodyHtml = `<div class="page">${md.render(
          fs.readFileSync(mdPath, "utf8")
        )}</div>`;
      } else {
        bodyHtml = await ejs.renderFile(
          path.join(__dirname, "views", viewName + ".ejs"),
          options
        );
      }

      res.render("layout", { ...options, body: bodyHtml });
    } catch (err) {
      next(err);
    }
  };

  next();
});

/* =========================
   VIEW ROUTES LOADER
   ========================= */

const walkViews = (dir, baseRoute = "") => {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!entry.startsWith("_") && !entry.startsWith("partials")) {
        walkViews(fullPath, path.join(baseRoute, entry));
      }
      continue;
    }

    const ext = path.extname(entry);
    if (![".ejs", ".md"].includes(ext)) continue;

    let routePath = path.join(baseRoute, entry.replace(ext, ""));
    routePath = routePath.replace(/\[(.+?)\]/g, ":$1");

    if (entry.replace(ext, "") === "index") {
      routePath = baseRoute || "/";
    } else {
      routePath = "/" + routePath.replace(/\\/g, "/");
    }

    app.get(routePath, async (req, res, next) => {
      try {
        let routeOptions = {};
        const viewName = path.join(baseRoute, entry.replace(ext, ""));
        const metaFile = path.join(dir, entry.replace(ext, ".meta.js"));

        if (fs.existsSync(metaFile)) {
          delete require.cache[require.resolve(metaFile)];
          const meta = require(metaFile);
          routeOptions =
            typeof meta === "function" ? await meta(req.params, req, db) : meta;
        }

        const defaultTitle =
          routePath === "/"
            ? "TeleWarp - Share projects"
            : entry
                .replace(ext, "")
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase()) +
              " - TeleWarp";

        res.renderWithLayout(viewName, {
          title: routeOptions.title || defaultTitle,
          params: req.params,
          ...routeOptions,
        });
      } catch (err) {
        next(err);
      }
    });
  }
};

/* =========================
   API ROUTES LOADER
   ========================= */

const walkApi = (dir, baseRoute = "") => {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!file.startsWith("_")) {
        walkApi(fullPath, path.join(baseRoute, file));
      }
      continue;
    }

    if (path.extname(file) !== ".js") continue;

    let routePath = path.join(baseRoute, file.replace(".js", ""));
    routePath = routePath.replace(/\[(.+?)\]/g, ":$1");

    if (file.replace(".js", "") === "index") {
      routePath = baseRoute || "/";
    } else {
      routePath = "/" + routePath.replace(/\\/g, "/");
    }

    app.all("/api" + routePath, async (req, res, next) => {
      try {
        delete require.cache[require.resolve(fullPath)];
        const handler = require(fullPath);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        // Handle preflight
        if (req.method === "OPTIONS") {
          return res.sendStatus(200);
        }

        if (typeof handler === "function") {
          await handler(req, res, db, __dirname);
        } else {
          res.status(500).json({ error: "API module does not export a function" });
        }
      } catch (err) {
        next(err);
      }
    });
  }
};

/* =========================
   DEP LOADER
   ========================= */

const mimeTypes = {
  ".js": "application/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".html": "text/html",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
};

app.get(/^\/dep\/(.+)$/, (req, res) => {
  const modulePath = req.params[0]; // everything after /dep/
  try {
    const resolved = require.resolve(modulePath, { paths: [__dirname] });
    res.type(mimeTypes[path.extname(resolved)] || "application/octet-stream");
    res.send(fs.readFileSync(resolved));
  } catch {
    res.status(404).json({ error: "Module not found" });
  }
});

/* =========================
   INIT + START
   ========================= */

walkApi(path.join(__dirname, "api"));
walkViews(path.join(__dirname, "views"));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
