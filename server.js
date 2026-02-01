const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json());

// Connect to PostgreSQL
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

// ✅ Signup Route
app.post("/auth/signup", async (req, res) => {
  const { roblox_user, roblox_id, password } = req.body;
  if (!roblox_user || !roblox_id || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const accountID = generateAccountID(roblox_user);

    const result = await pool.query(
      `INSERT INTO users (roblox_user, roblox_id, account_password, account_id, owned_server_ids, server_ids)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, account_id`,
      [roblox_user, roblox_id, hashedPassword, accountID, [], []]
    );

    res.json({
      message: "Signup successful",
      userID: result.rows[0].id,
      accountID: result.rows[0].account_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ✅ Login Route
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

// Start server
app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
