const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();

// Connect to Postgres using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure users table exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        discriminator TEXT,
        avatar TEXT,
        plan TEXT,
        infractions INT DEFAULT 0,
        promotions INT DEFAULT 0,
        announcements INT DEFAULT 0,
        password TEXT
      )
    `);
    console.log("Users table ready");
  } catch (err) {
    console.error("Error creating users table:", err);
  }
})();

// Simple in-memory sessions
let sessions = {};

// Login route (Discord OAuth)
app.get("/login", (req, res) => {
  const plan = req.query.plan || "free";
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${plan}`;
  res.redirect(redirect);
});

// Callback after Discord login
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const plan = req.query.state;

  if (!code) return res.status(400).send("No code provided");

  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        scope: "identify email"
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).send("Failed to get access token: " + JSON.stringify(tokenData));
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    const avatarUrl = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    // Insert or update user in DB
    await pool.query(
      `INSERT INTO users (id, username, discriminator, avatar, plan)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET username=$2, discriminator=$3, avatar=$4, plan=$5`,
      [userData.id, userData.username, userData.discriminator, avatarUrl, plan]
    );

    // Create session token
    const sessionToken = Math.random().toString(36).substring(2);
    sessions[sessionToken] = userData.id;

    // Redirect to dashboard folder
    res.redirect(`/dashboard/user.html?token=${sessionToken}`);
  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).send("Error during Discord login");
  }
});

// Middleware for session check
async function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (token && sessions[token]) {
    const userId = sessions[token];
    const result = await pool.query("SELECT * FROM users WHERE id=$1", [userId]);
    req.user = result.rows[0];
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
}

// API: get user info
app.get("/api/user", authMiddleware, (req, res) => {
  res.json(req.user);
});

// Logout
app.get("/logout", (req, res) => {
  const token = req.query.token;
  if (token) delete sessions[token];
  res.redirect("/");
});

// Serve static files (includes /dashboard folder)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
