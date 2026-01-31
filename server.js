const express = require("express");
const fetch = require("node-fetch");
const Database = require("@replit/database");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const db = new Database();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug: confirm secrets are loaded
console.log("Client ID:", process.env.DISCORD_CLIENT_ID);
console.log("Redirect URI:", process.env.DISCORD_REDIRECT_URI);

// Login route (Discord OAuth)
app.get("/login", (req, res) => {
  const plan = req.query.plan || "free";
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${plan}`;
  console.log("Redirecting to:", redirect);
  res.redirect(redirect);
});

// Callback after Discord login
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const plan = req.query.state;

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
        scope: "identify email"
      })
    });

    const tokenData = await tokenResponse.json();
    console.log("Token Data:", tokenData);

    if (!tokenData.access_token) {
      return res.status(400).send("Failed to get access token: " + JSON.stringify(tokenData));
    }

    // Get user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();
    console.log("User Data:", userData);

    const existingUser = await db.get(userData.id);

    if (existingUser) {
      // Inline password form
      res.send(`
        <html>
          <body style="background:#0b0b0b;color:#fff;font-family:Arial;text-align:center;padding:2rem;">
            <h1>Welcome back, ${userData.username}#${userData.discriminator}</h1>
            <form method="POST" action="/password-check" style="margin:2rem auto;max-width:300px;background:#1a1a1a;padding:2rem;border-radius:8px;">
              <input type="hidden" name="discordId" value="${userData.id}">
              <label>Password:</label><br>
              <input type="password" name="password" required style="width:100%;padding:0.5rem;margin:0.5rem 0;border-radius:4px;border:none;"><br>
              <button type="submit" style="background:#a020f0;color:#fff;border:none;padding:0.7rem 1.2rem;border-radius:6px;cursor:pointer;">Login</button>
            </form>
          </body>
        </html>
      `);
    } else {
      // New user → redirect to signup page in correct folder
      res.redirect(`/plans/${plan}/signup.html?discordId=${userData.id}&plan=${plan}`);
    }
  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).send("Error during Discord login");
  }
  const tokenData = await tokenResponse.json();
  console.log("Token Data:", tokenData);

  if (!tokenData.access_token) {
    return res.status(400).send("Failed to get access token: " + JSON.stringify(tokenData));
  }

});

// Password check endpoint
app.post("/password-check", async (req, res) => {
  const { discordId, password } = req.body;
  const user = await db.get(discordId);

  if (!user || !user.password) return res.status(400).send("User not found or no password set");

  const match = await bcrypt.compare(password, user.password);
  if (match) {
    res.send("Login successful");
  } else {
    res.status(401).send("Invalid password");
  }
});

// Signup endpoint
app.post("/signup", async (req, res) => {
  const { discordId, password, plan } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  await db.set(discordId, {
    username: req.body.username || null,
    plan,
    password: hashedPassword
  });

  res.send("Signup complete");
});

// Serve static files last (homepage, plans folder, etc.)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
