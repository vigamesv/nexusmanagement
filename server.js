const express = require("express");
const fetch = require("node-fetch");
const Database = require("@replit/database"); // ✅ correct import
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const db = new Database();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // serve index.html, styles.css, script.js, and plans folder

// Login route (called from login.html buttons)
app.get("/login", (req, res) => {
  const plan = req.query.plan || "free"; // default to free
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${plan}`;
  res.redirect(redirect);
});

// Discord callback route
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const plan = req.query.state; // plan passed through OAuth state

  if (!code) return res.status(400).send("No code provided");

  try {
    // Exchange code for token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        scope: "identify email",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).send("Failed to get access token");
    }

    // Get user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userResponse.json();

    // Save to Replit DB keyed by Discord ID
    await db.set(userData.id, {
      username: userData.username,
      discriminator: userData.discriminator,
      email: userData.email,
      plan: plan,
      password: null, // optional if you let them set one later
    });

    // Redirect to a dashboard or confirmation page
    res.send(
      `Logged in as ${userData.username}#${userData.discriminator} on ${plan} plan`,
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Error during Discord login");
  }
});

// Optional register endpoint (if you want to let them set a password after Discord login)
app.post("/register", async (req, res) => {
  const { discordId, password } = req.body;
  if (!discordId || !password) return res.status(400).send("Missing fields");

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.get(discordId);
    if (!user) return res.status(400).send("User not found");

    user.password = hashedPassword;
    await db.set(discordId, user);
    res.send("Password set successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error registering user");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
