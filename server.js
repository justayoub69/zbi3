const express = require("express");
const multer = require("multer");
const fs = require("fs");
const session = require("express-session");

const app = express();

// ===== CONFIG =====
const ADMIN_PATH = "/admin-a8fK29xP7LmQ"; // change if you want
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

app.use(session({
  secret: "ultra-secret-key",
  resave: false,
  saveUninitialized: true
}));

const upload = multer({ dest: "uploads/" });

// ===== MEMORY DB =====
let apps = [];

// ===== AUTH =====
function requireAuth(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login");
}

// ===== LOGIN =====
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

app.post("/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    return res.redirect(ADMIN_PATH);
  }

  setTimeout(() => {
    res.send("Wrong password");
  }, 1200);
});

// ===== ADMIN PANEL =====
app.get(ADMIN_PATH, requireAuth, (req, res) => {
  res.sendFile(__dirname + "/public/admin.html");
});

// ===== UPLOAD =====
app.post("/upload", requireAuth, upload.fields([
  { name: "ipa" },
  { name: "icon" }
]), (req, res) => {

  const id = Date.now();

  const appData = {
    id,
    name: req.body.name,
    ipa: `/uploads/${req.files.ipa[0].filename}`,
    icon: `/uploads/${req.files.icon[0].filename}`,
    installs: 0,
    lastInstall: null
  };

  apps.push(appData);

  generatePlist(appData, req);

  res.redirect(ADMIN_PATH);
});

// ===== GET APPS (PUBLIC) =====
app.get("/apps", (req, res) => {
  res.json(apps);
});

// ===== INSTALL TRACKING =====
app.get("/install/:id", (req, res) => {
  const appItem = apps.find(a => a.id == req.params.id);
  if (!appItem) return res.send("Not found");

  appItem.installs++;
  appItem.lastInstall = new Date().toISOString();

  const BASE_URL = `https://${req.headers.host}`;

  res.redirect(
    `itms-services://?action=download-manifest&url=${BASE_URL}/${appItem.id}.plist`
  );
});

// ===== ANALYTICS =====
app.get("/analytics", requireAuth, (req, res) => {
  const totalInstalls = apps.reduce((sum, a) => sum + a.installs, 0);

  res.json({
    totalApps: apps.length,
    totalInstalls,
    apps
  });
});

// ===== PLIST GENERATOR =====
function generatePlist(appData, req) {
  const BASE_URL = `https://${req.headers.host}`;

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
<items>
<dict>
<assets>
<array>
<dict>
<key>kind</key>
<string>software-package</string>
<key>url</key>
<string>${BASE_URL}${appData.ipa}</string>
</dict>
</array>
</assets>
<metadata>
<key>bundle-identifier</key>
<string>com.example.app</string>
<key>bundle-version</key>
<string>1.0</string>
<key>kind</key>
<string>software</string>
<key>title</key>
<string>${appData.name}</string>
</metadata>
</dict>
</items>
</dict>
</plist>`;

  fs.writeFileSync(`public/${appData.id}.plist`, plist);
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on " + PORT));