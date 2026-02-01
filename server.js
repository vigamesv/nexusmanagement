const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Serve static files (homepage, CSS, JS, dashboard pages)
app.use(express.static(path.join(__dirname)));
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// PostgreSQL connection
const pool = new Pool({
  connectionString: "postgresql://postgres:password@helium/heliumdb?sslmode=disable"
});

// Utility: generate account ID
function generateAccountID(robloxUser) {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const timeStr = date.toTimeString().split(" ")[0]; // HH:MM:SS
  const last4 = robloxUser.slice(-4);
  return `${dateStr}-${timeStr}-${last4}`;
}

// ✅ Homepage route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ Roblox account linking
app.get("/auth/link-roblox", async (req, res) => {
  try {
    // Example: call Roblox API to get current user info
    // Replace with correct Open Cloud endpoint
    const response = await fetch("https://apis.roblox.com/users/v1/users/me", {
      headers: { "x-api-key": process.env.ROBLOX_API_KEY }
    });
    const data = await response.json();

    const roblox_user = data.name;
    const roblox_id = data.id;
    const accountID = generateAccountID(roblox_user);

    // Save user record with empty password initially
    await pool.query(
      `INSERT INTO users (roblox_user, roblox_id, account_password, account_id, owned_server_ids, server_ids)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (roblox_id) DO NOTHING`,
      [roblox_user, roblox_id, "", accountID, [], []]
    );

    // Redirect to signup page with account ID
    res.redirect(`/dashboard/signup.html?ID=${accountID}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Roblox linking failed");
  }
});

// ✅ Signup (password only)
app.post("/auth/signup", async (req, res) => {
  const { account_id, password } = req.body;
  if (!account_id || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "UPDATE users SET account_password = $1 WHERE account_id = $2",
      [hashedPassword, account_id]
    );

    res.json({
      message: "Signup successful",
      accountID: account_id,
      redirectURL: `/dashboard/user.html?ID=${account_id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Login
app.post("/auth/login", async (req, res) => {
  const { roblox_user, password } = req.body;
  if (!roblox_user || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE roblox_user = $1",
      [roblox_user]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.account_password);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.json({
      message: "Login successful",
      accountID: user.account_id,
      redirectURL: `/dashboard/user.html?ID=${user.account_id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Fetch user info
app.get("/api/user/:accountID", async (req, res) => {
  const { accountID } = req.params;
  try {
    const result = await pool.query(
      "SELECT roblox_user, account_id FROM users WHERE account_id = $1",
      [accountID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
