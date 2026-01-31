const express = require("express");
const Database = require("@replit/database");
const bcrypt = require("bcrypt");
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

    let existingUser = await db.get(userData.id);

    if (!existingUser) {
      // First time login → create record without password
      await db.set(userData.id, {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        plan,
        infractions: 0,
        promotions: 0
      });
    } else {
      // Update username/discriminator each login
      existingUser.username = userData.username;
      existingUser.discriminator = userData.discriminator;
      existingUser.plan = plan;
      await db.set(userData.id, existingUser);
    }

    // Redirect to password entry page
    return res.redirect(`/dashboard/login-pass.html?id=${userData.id}`);
  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).send("Error during Discord login");
  }
});

// --- Route to set/check password ---
app.post("/check-password", async (req, res) => {
  const { id, password } = req.body;
  const user = await db.get(id);
  if (!user) return res.status(400).send("User not found");

  if (!user.hashedPassword) {
    // First time setting password
    const hashed = await bcrypt.hash(password, 10);
    user.hashedPassword = hashed;
    await db.set(id, user);
  } else {
    // Verify password
    const match = await bcrypt.compare(password, user.hashedPassword);
    if (!match) return res.status(401).send("Invalid password");
  }

  // Issue session token
  const sessionToken = Math.random().toString(36).substring(2);
  await saveSession(sessionToken, id);
  res.json({ token: sessionToken });
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
