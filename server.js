const express = require("express");
const Database = require("@replit/database");
require("dotenv").config();

const app = express();
const db = new Database();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Sessions stored in DB for persistence ---
async function saveSession(token, userId) {
  await db.set("session:" + token, userId);
}
async function getSession(token) {
  return await db.get("session:" + token);
}

// --- Login route (Discord OAuth) ---
app.get("/login", (req, res) => {
  const plan = req.query.plan || "free";
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${plan}`;
  res.redirect(redirect);
});

// --- Callback after Discord login ---
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

    // Always save Discord username + discriminator
    await db.set(userData.id, {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      plan,
      infractions: 0,
      promotions: 0
    });

    // Create session token and persist it
    const sessionToken = Math.random().toString(36).substring(2);
    await saveSession(sessionToken, userData.id);

    res.redirect(`/dashboard/user.html?token=${sessionToken}`);
  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).send("Error during Discord login");
  }
});

// --- Middleware for session check ---
async function authMiddleware(req, res, next) {
  const token = req.headers["authorization"];
  if (token) {
    const userId = await getSession(token);
    if (userId) {
      const user = await db.get(userId);
      req.user = user;
      return next();
    }
  }
  res.status(401).send("Unauthorized");
}

// --- API: get user info ---
app.get("/api/user", authMiddleware, (req, res) => {
  res.json(req.user);
});

// --- Logout ---
app.get("/logout", async (req, res) => {
  const token = req.query.token;
  if (token) {
    await db.delete("session:" + token);
  }
  res.redirect("/");
});

// --- Serve static files ---
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
