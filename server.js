const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS for cross-origin requests

// Serve static files
app.use(express.static(path.join(__dirname)));
app.use("/dashboard", express.static(path.join(__dirname, "dashboard")));

// PostgreSQL connection with environment variable support
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_0C7wWNVpPbKI@ep-soft-butterfly-a5vznin4.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: {
    rejectUnauthorized: false // Required for most cloud PostgreSQL services
  }
});

// Test database connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('Database connected successfully');
    release();
  }
});

// Create tables if they don't exist
async function initializeDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        account_password TEXT NOT NULL,
        account_id VARCHAR(255) UNIQUE NOT NULL,
        owned_server_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
        server_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id)`);
    
    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err.message);
    console.error('Full error:', err);
  }
}

// Initialize database on startup
initializeDatabase();

// Utility: generate account ID
function generateAccountID(username) {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0].replace(/-/g, '');
  const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, '');
  const last4 = username.slice(-4).padStart(4, '0');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `NXS-${dateStr}-${timeStr}-${last4}-${randomNum}`;
}

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Signup
app.post("/auth/signup", async (req, res) => {
  const { username, password } = req.body;
  
  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT username FROM users WHERE username = $1",
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const accountID = generateAccountID(username);
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, account_password, account_id, owned_server_ids, server_ids)
       VALUES ($1, $2, $3, $4, $5)`,
      [username, hashedPassword, accountID, [], []]
    );

    console.log(`New user created: ${username} (${accountID})`);

    res.status(201).json({
      success: true,
      message: "Signup successful",
      accountID,
      redirectURL: `/dashboard/user.html?ID=${accountID}`
    });
  } catch (err) {
    console.error("Signup DB error:", err.message);
    res.status(500).json({ error: "Database error. Please try again." });
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
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.account_password);

    if (!validPassword) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    console.log(`User logged in: ${username}`);

    res.json({
      success: true,
      message: "Login successful",
      accountID: user.account_id,
      username: user.username,
      redirectURL: `/dashboard/user.html?ID=${user.account_id}`
    });
  } catch (err) {
    console.error("Login DB error:", err.message);
    res.status(500).json({ error: "Database error. Please try again." });
  }
});

// Fetch user info
app.get("/api/user/:accountID", async (req, res) => {
  const { accountID } = req.params;
  
  if (!accountID) {
    return res.status(400).json({ error: "Account ID is required" });
  }

  try {
    const result = await pool.query(
      "SELECT username, account_id, owned_server_ids, server_ids, created_at FROM users WHERE account_id = $1",
      [accountID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (err) {
    console.error("User fetch DB error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Update user data (for adding servers, etc)
app.put("/api/user/:accountID/update", async (req, res) => {
  const { accountID } = req.params;
  const { owned_server_ids, server_ids } = req.body;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID is required" });
  }

  try {
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (owned_server_ids !== undefined) {
      updates.push(`owned_server_ids = $${paramCount}`);
      values.push(owned_server_ids);
      paramCount++;
    }

    if (server_ids !== undefined) {
      updates.push(`server_ids = $${paramCount}`);
      values.push(server_ids);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(accountID);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE account_id = $${paramCount} RETURNING username, account_id, owned_server_ids, server_ids`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`User updated: ${accountID}`);

    res.json({
      success: true,
      message: "User updated successfully",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("User update DB error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Logout
app.get("/auth/logout", (req, res) => {
  res.redirect("/");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Use PORT from environment variable (Render provides this)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
  });
});
