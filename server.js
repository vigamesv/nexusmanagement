const express = require("express");
const fetch = require("node-fetch");
const Database = require("@replit/database");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
const db = new Database();

console.log("Client ID:", process.env.DISCORD_CLIENT_ID);
console.log("Redirect URI:", process.env.DISCORD_REDIRECT_URI);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Login route (Discord OAuth)
app.get("/login", (req, res) => {
  const plan = req.query.plan || "free";
  const redirect = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email&state=${plan}`;
  console.log("Redirecting to:", redirect);
  res.redirect(redirect);
});


// Callback route (Discord OAuth)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
