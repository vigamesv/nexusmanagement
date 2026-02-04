const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// PostgreSQL connection
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_0C7wWNVpPbKI@ep-soft-butterfly-a5vznin4.us-east-2.aws.neon.tech/neondb?sslmode=require"
});

// Utility: generate account ID
function generateAccountID(username) {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0];
  const timeStr = date.toTimeString().split(" ")[0];
  const last4 = username.slice(-4);
  return `${dateStr}-${timeStr}-${last4}`;
}

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Signup
app.post("/auth/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const accountID = generateAccountID(username);
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, account_password, account_id, owned_server_ids, server_ids)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO NOTHING`,
      [username, hashedPassword, accountID, '{}', '{}']
    );

    res.json({
      message: "Signup successful",
      accountID,
      redirectURL: `/dashboard/user.html?ID=${accountID}`
    });
  } catch (err) {
    console.error("Signup DB error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
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
    console.error("Login DB error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Fetch user info
app.get("/api/user/:accountID", async (req, res) => {
  const { accountID } = req.params;
  try {
    const result = await pool.query(
      "SELECT username, account_id FROM users WHERE account_id = $1",
      [accountID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("User fetch DB error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Logout
app.get("/auth/logout", (req, res) => {
  res.redirect("/");
});

app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
