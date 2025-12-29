const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const crypto = require("crypto");

const AVATAR_DIR = "telewarp-avatars";
const MAX_SIZE = 1 * 1024 * 1024; // 1MB
const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = "sha512";

// --- Internal Helpers ---

const hashPassword = (password) => new Promise((resolve, reject) => {
  const salt = crypto.randomBytes(16).toString("hex");
  crypto.pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST, (err, key) => {
    if (err) reject(err);
    else resolve({ salt, hash: key.toString("hex") });
  });
});

const verifyPassword = (password, salt, hash) => new Promise((resolve, reject) => {
  crypto.pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST, (err, key) => {
    if (err) reject(err);
    else resolve(key.toString("hex") === hash);
  });
});

function getImageDimensions(buffer) {
  // PNG
  if (buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // GIF
  if (buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      const marker = buffer.readUInt16BE(offset);
      offset += 2;
      if (marker === 0xFFC0 || marker === 0xFFC2) {
        return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
      }
      offset += buffer.readUInt16BE(offset);
    }
  }
  return null;
}

// --- Main Module ---

module.exports = async (req, res, db, dirname) => {
  const action = req.query.action;
  const avatarsPath = path.join(dirname, AVATAR_DIR);
  if (!fsSync.existsSync(avatarsPath)) await fs.mkdir(avatarsPath, { recursive: true });

  const getSession = async () => {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const token = cookieHeader.split(';').find(c => c.trim().startsWith('tw_session='))?.split('=')[1];
    if (!token) return null;
    try {
      const session = await db.get(`session:${token}`);
      return (Date.now() < session.expires) ? session : null;
    } catch { return null; }
  };

  try {
    // 1. GET PROFILE OR IMAGE
    if (action === "get") {
      const targetUser = req.query.user;
      if (!targetUser) return res.status(400).json({ error: "Missing username" });

      let userData;
      try {
        userData = await db.get(`user:${targetUser.toLowerCase()}`);
      } catch {
        return res.status(404).json({ error: "User not found" });
      }

      if (req.query.type === "image") {
        const filePath = userData.avatarFile ? path.join(avatarsPath, userData.avatarFile) : null;
        if (filePath && fsSync.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader("Content-Type", ext === ".gif" ? "image/gif" : ext === ".png" ? "image/png" : "image/jpeg");
          return res.sendFile(filePath);
        } else {
          // Default fallback
          res.setHeader("Content-Type", "image/png");
          return res.sendFile(path.join(dirname, "user.png"));
        }
      }

      return res.json({
        username: userData.username,
        bio: userData.bio || "",
        joined: userData.joined,
        featuredProjectId: userData.featuredProjectId || null,
        avatarUrl: `/api/user-api?action=get&user=${userData.username}&type=image`
      });
    }

    // 2. SIGN UP
// 2. SIGN UP
    if (action === "signup") {
      const { username, password } = req.body;
      if (!username || !password || username.length < 3 || password.length < 8) {
        return res.status(400).json({ error: "Invalid username/password length" });
      }
      const userKey = `user:${username.toLowerCase()}`;
      
      let userExists = false;
      try {
        const existing = await db.get(userKey);
        // If the DB returns a truthy value instead of throwing, the user exists
        if (existing) userExists = true; 
      } catch (e) {
        // This is where it SHOULD land if the username is available
        userExists = false; 
      }

      if (userExists) {
        return res.status(400).json({ error: "Username taken" });
      }

      const { salt, hash } = await hashPassword(password);
      await db.put(userKey, { 
        username, 
        salt, 
        hash, 
        joined: Date.now(), 
        bio: "", 
        featuredProjectId: null 
      });
      
      return res.json({ success: true });
    }

    // 3. SIGN IN
    if (action === "signin") {
      const { username, password } = req.body;
      let userData;
      try {
        userData = await db.get(`user:${username.toLowerCase()}`);
      } catch {
        return res.status(401).json({ error: "User not found" });
      }

      const isValid = await verifyPassword(password, userData.salt, userData.hash);
      if (!isValid) return res.status(401).json({ error: "Incorrect password" });

      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.put(`session:${token}`, { username: userData.username, expires: expires.getTime() });

      res.setHeader("Set-Cookie", [`tw_session=${token}; HttpOnly; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax`]);
      return res.json({ success: true, user: { username: userData.username } });
    }

    // 4. UPDATE PROFILE
    if (action === "update") {
      const session = await getSession();
      if (!session) return res.status(401).json({ error: "Unauthorized" });

      const userKey = `user:${session.username.toLowerCase()}`;
      const userData = await db.get(userKey);

      if (req.body.bio !== undefined) userData.bio = req.body.bio.substring(0, 500);
      if (req.body.featuredProjectId) userData.featuredProjectId = req.body.featuredProjectId;

      await db.put(userKey, userData);
      return res.json({ success: true });
    }

    // 5. UPLOAD AVATAR
    if (action === "upload_avatar") {
      const session = await getSession();
      if (!session) return res.status(401).json({ error: "Unauthorized" });

      const avatarFile = req.files?.avatar?.[0];
      if (!avatarFile || avatarFile.size > MAX_SIZE) {
        return res.status(400).json({ error: "File missing or over 1MB" });
      }

      const buffer = await fs.readFile(avatarFile.path);
      const dims = getImageDimensions(buffer);

      if (!dims || dims.width > 512 || dims.height > 512) {
        await fs.unlink(avatarFile.path).catch(() => {});
        return res.status(400).json({ error: "Max dimensions 512x512px" });
      }

      const ext = path.extname(avatarFile.originalname).toLowerCase();
      const finalName = `avatar_${session.username.toLowerCase()}${ext}`;
      await fs.rename(avatarFile.path, path.join(avatarsPath, finalName));

      const userKey = `user:${session.username.toLowerCase()}`;
      const userData = await db.get(userKey);
      userData.avatarFile = finalName;
      await db.put(userKey, userData);

      return res.json({ success: true });
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Error" });
  }
};