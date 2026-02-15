const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
const router = express.Router();

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
    console.error('❌ DATABASE CONNECTION FAILED');
    console.error('Error details:', err.stack);
    console.error('Connection string (masked):', process.env.DATABASE_URL ? 'Exists' : 'Missing');
  } else {
    console.log('✅ Database connected successfully');
    console.log('Database host:', client.host);
    console.log('Database name:', client.database);
    release();
  }
});

// Create tables if they don't exist
async function initializeDatabase() {
  console.log('🔧 Initializing database tables...');
  
  try {
    // Drop old tables if they have wrong structure
    console.log('Checking table structure...');
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'username'
    `);
    
    if (checkColumns.rows.length === 0) {
      console.log('Recreating users table with correct structure...');
      await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
    }
    
    // Create users table with correct structure
    console.log('Creating users table...');
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
    console.log('✅ Users table ready');
    
    // Create servers table
    console.log('Creating servers table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        owner_account_id VARCHAR(255) NOT NULL,
        erlc_server_id VARCHAR(255),
        api_key TEXT,
        plan VARCHAR(50) DEFAULT 'Free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Servers table ready');
    
    // Create indexes
    console.log('Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_account_id)`);
    console.log('✅ Indexes ready');
    
    console.log('✅ Database tables initialized successfully');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 Tables in database:', result.rows.map(r => r.table_name).join(', '));
    
  } catch (err) {
    console.error('❌ Error initializing database');
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Full error:', err);
  }
}

// Initialize database on startup
// DISABLED - Run manual SQL script instead
// initializeDatabase();

// Utility: generate account ID
function generateAccountID(username) {
  const date = new Date();
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const timeStr = date.toTimeString().split(" ")[0]; // HH:MM:SS
  const last4 = username.slice(-4);
  return `${dateStr}-${timeStr}-${last4}`;
}

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check endpoint for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Database status endpoint for debugging
app.get("/api/db-status", async (req, res) => {
  try {
    // Test connection
    const client = await pool.connect();
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Check users table structure
    let usersColumns = [];
    try {
      const usersResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      usersColumns = usersResult.rows;
    } catch (e) {
      usersColumns = ['Table does not exist'];
    }
    
    client.release();
    
    res.json({
      status: 'connected',
      database: client.database,
      tables: tablesResult.rows.map(r => r.table_name),
      usersTableColumns: usersColumns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// Test insert endpoint
app.get("/api/test-insert", async (req, res) => {
  try {
    const testUsername = 'testuser_' + Date.now();
    const testPassword = await bcrypt.hash('testpass123', 10);
    const testAccountID = generateAccountID(testUsername);
    
    console.log('Testing insert with:', { testUsername, testAccountID });
    
    // Try to insert
    await pool.query(
      `INSERT INTO users (username, account_password, account_id, owned_server_ids, server_ids)
       VALUES ($1, $2, $3, $4, $5)`,
      [testUsername, testPassword, testAccountID, [], []]
    );
    
    console.log('Insert successful!');
    
    // Verify it was inserted
    const result = await pool.query(
      'SELECT username, account_id FROM users WHERE username = $1',
      [testUsername]
    );
    
    // Clean up test user
    await pool.query('DELETE FROM users WHERE username = $1', [testUsername]);
    
    res.json({
      success: true,
      message: 'Test insert worked!',
      testData: result.rows[0]
    });
  } catch (error) {
    console.error('Test insert failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
});

// Signup
app.post("/auth/signup", async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Signup attempt:', { username, hasPassword: !!password });
  
  // Validation
  if (!username || !password) {
    console.log('Signup failed: Missing fields');
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (username.length < 3) {
    console.log('Signup failed: Username too short');
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }

  if (password.length < 6) {
    console.log('Signup failed: Password too short');
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT username FROM users WHERE username = $1",
      [username]
    );

    if (existingUser.rows.length > 0) {
      console.log('Signup failed: Username exists');
      return res.status(409).json({ error: "Username already exists" });
    }

    const accountID = generateAccountID(username);
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Creating user with ID:', accountID);

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
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Database error. Please try again.",
      details: err.message 
    });
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

// ============= SERVER MANAGEMENT ENDPOINTS =============

// Create new server
app.post("/api/servers/create", async (req, res) => {
  const { serverId, name, apiKey, accountID } = req.body;

  console.log('📝 Server creation request:', { serverId, name, hasApiKey: !!apiKey, accountID });

  if (!serverId || !name || !accountID) {
    console.log('❌ Missing required fields');
    return res.status(400).json({ 
      error: "Missing required fields",
      code: "MISSING_FIELDS"
    });
  }

  try {
    // Verify user exists
    console.log('🔍 Checking if user exists:', accountID);
    const userResult = await pool.query(
      "SELECT account_id FROM users WHERE account_id = $1",
      [accountID]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ User not found:', accountID);
      return res.status(404).json({ 
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    console.log('✅ User found, creating server...');

    // Create server with API key
    await pool.query(
      `INSERT INTO servers (id, name, description, owner_account_id, api_key)
       VALUES ($1, $2, $3, $4, $5)`,
      [serverId, name, 'ER:LC Community Server', accountID, apiKey || null]
    );

    console.log('✅ Server inserted into database');

    // Add server ID to user's owned_server_ids
    await pool.query(
      `UPDATE users 
       SET owned_server_ids = array_append(owned_server_ids, $1)
       WHERE account_id = $2`,
      [serverId, accountID]
    );

    console.log('✅ Server added to user\'s owned_server_ids');
    console.log(`🎉 Server created: ${name} (${serverId}) by ${accountID}`);

    res.status(201).json({
      success: true,
      message: "Server created successfully",
      serverId: serverId
    });
  } catch (err) {
    console.error("❌ Error creating server:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Database error",
      code: "DATABASE_ERROR",
      details: err.message 
    });
  }
});

// Get all servers for a user
app.get("/api/servers/user/:accountID", async (req, res) => {
  const { accountID } = req.params;

  try {
    // Get servers owned by user
    const ownedResult = await pool.query(
      `SELECT id, name, description, plan, created_at 
       FROM servers 
       WHERE owner_account_id = $1
       ORDER BY created_at DESC`,
      [accountID]
    );

    // Get servers where user is a member (from user's server_ids array)
    const userResult = await pool.query(
      "SELECT server_ids FROM users WHERE account_id = $1",
      [accountID]
    );

    let memberServers = [];
    if (userResult.rows.length > 0 && userResult.rows[0].server_ids) {
      const memberIds = userResult.rows[0].server_ids;
      
      if (memberIds.length > 0) {
        const memberResult = await pool.query(
          `SELECT s.id, s.name, s.description, s.plan, u.username as owner
           FROM servers s
           JOIN users u ON s.owner_account_id = u.account_id
           WHERE s.id = ANY($1)
           ORDER BY s.created_at DESC`,
          [memberIds]
        );
        memberServers = memberResult.rows;
      }
    }

    res.json({
      success: true,
      ownedServers: ownedResult.rows.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        plan: s.plan,
        staffCount: 0, // TODO: Calculate from staff table
        createdAt: s.created_at
      })),
      memberServers: memberServers.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        plan: s.plan,
        staffCount: 0,
        owner: s.owner
      }))
    });
  } catch (err) {
    console.error("Error fetching servers:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Get server settings
app.get("/api/servers/:serverId/settings", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  console.log('📋 GET /api/servers/:serverId/settings');
  console.log('   Server ID:', serverId);
  console.log('   Account ID:', accountID);

  if (!accountID) {
    console.log('❌ ERROR: Missing accountID');
    return res.status(400).json({ 
      error: "Account ID required",
      code: "MISSING_ACCOUNT_ID"
    });
  }

  try {
    console.log('🔍 Querying servers table...');
    const result = await pool.query(
      "SELECT * FROM servers WHERE id = $1",
      [serverId]
    );

    console.log(`   Found ${result.rows.length} server(s)`);

    if (result.rows.length === 0) {
      console.log('❌ ERROR: Server not found in database');
      console.log('   Searched for ID:', serverId);
      return res.status(404).json({ 
        error: "Server not found",
        code: "SERVER_NOT_FOUND",
        serverId: serverId
      });
    }

    const server = result.rows[0];
    console.log('✅ Server found:', server.name);

    // Verify user owns or is member of this server
    console.log('🔍 Checking user access...');
    const userResult = await pool.query(
      "SELECT owned_server_ids, server_ids FROM users WHERE account_id = $1",
      [accountID]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ ERROR: User not found');
      return res.status(403).json({ 
        error: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    const user = userResult.rows[0];
    console.log('   User owned servers:', user.owned_server_ids);
    console.log('   User member servers:', user.server_ids);
    
    const hasAccess = (user.owned_server_ids && user.owned_server_ids.includes(serverId)) ||
                      (user.server_ids && user.server_ids.includes(serverId));

    if (!hasAccess) {
      console.log('❌ ERROR: User does not have access to this server');
      return res.status(403).json({ 
        error: "You don't have access to this server",
        code: "ACCESS_DENIED"
      });
    }

    console.log('✅ Access granted');

    // Don't send the full API key, just indicate if it exists
    res.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        description: server.description,
        plan: server.plan || 'Free',
        apiKey: !!server.api_key,
        createdAt: server.created_at
      }
    });
    
    console.log('✅ Server settings sent successfully');
  } catch (err) {
    console.error("❌ DATABASE ERROR:", err.message);
    console.error("   Stack:", err.stack);
    res.status(500).json({ 
      error: "Database error",
      code: "DATABASE_ERROR",
      details: err.message
    });
  }
});

// Update server settings (API keys)
app.put("/api/servers/:serverId/settings", async (req, res) => {
  const { serverId } = req.params;
  const { accountID, apiKey, erlcServerId } = req.body;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    // Verify user owns this server
    const userResult = await pool.query(
      "SELECT owned_server_ids FROM users WHERE account_id = $1",
      [accountID]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = userResult.rows[0];
    if (!user.owned_server_ids || !user.owned_server_ids.includes(serverId)) {
      return res.status(403).json({ error: "You don't own this server" });
    }

    // Update server with API key
    const result = await pool.query(
      `UPDATE servers 
       SET api_key = $1, erlc_server_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [apiKey, erlcServerId || null, serverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Server not found" });
    }

    console.log(`Server ${serverId} API settings updated`);

    res.json({
      success: true,
      message: "Server settings updated successfully"
    });
  } catch (err) {
    console.error("Error updating server settings:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Delete server
app.delete("/api/servers/:serverId/delete", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.body;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    // Verify user owns this server
    const userResult = await pool.query(
      "SELECT owned_server_ids FROM users WHERE account_id = $1",
      [accountID]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = userResult.rows[0];
    if (!user.owned_server_ids || !user.owned_server_ids.includes(serverId)) {
      return res.status(403).json({ error: "You don't own this server" });
    }

    // Delete server from database
    await pool.query("DELETE FROM servers WHERE id = $1", [serverId]);

    // Remove from user's owned_server_ids
    await pool.query(
      `UPDATE users 
       SET owned_server_ids = array_remove(owned_server_ids, $1)
       WHERE account_id = $2`,
      [serverId, accountID]
    );

    // Also remove from any user's server_ids (in case they were added as members)
    await pool.query(
      `UPDATE users 
       SET server_ids = array_remove(server_ids, $1)
       WHERE $1 = ANY(server_ids)`,
      [serverId]
    );

    console.log(`Server ${serverId} deleted by ${accountID}`);

    res.json({
      success: true,
      message: "Server deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting server:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// ============= ER:LC API INTEGRATION =============

// Test ER:LC API connection
app.post("/api/erlc/test-connection", async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "API key required" });
  }

  try {
    // Test connection by getting server info
    // The apiKey here is actually the SERVER KEY from ER:LC settings
    const response = await fetch(`https://api.policeroleplay.community/v1/server`, {
      method: 'GET',
      headers: {
        'server-key': apiKey,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ER:LC API error:', response.status, errorText);
      return res.json({
        success: false,
        error: `API returned ${response.status}. Make sure you're using your Server Key from ER:LC settings, not a PRC account password.`
      });
    }

    const serverInfo = await response.json();

    res.json({
      success: true,
      server: serverInfo
    });
  } catch (error) {
    console.error("ER:LC API test error:", error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get server info from ER:LC API
app.get("/api/erlc/server-info/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    // Get server API key from database
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Server not found" });
    }

    const server = result.rows[0];

    if (!server.api_key) {
      return res.json({
        success: false,
        error: "Server API not configured"
      });
    }

    // Fetch server info from ER:LC API
    const response = await fetch(`https://api.policeroleplay.community/v1/server`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({
        success: false,
        error: `ER:LC API error: ${response.status}`
      });
    }

    const serverInfo = await response.json();

    res.json({
      success: true,
      serverInfo: serverInfo
    });
  } catch (error) {
    console.error("Error fetching ER:LC server info:", error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Get server staff from ER:LC API
app.get("/api/erlc/staff/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/staff`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const staff = await response.json();

    res.json({
      success: true,
      staff: staff
    });
  } catch (error) {
    console.error("Error fetching staff:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get server players from ER:LC API
app.get("/api/erlc/players/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/players`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const players = await response.json();

    res.json({
      success: true,
      players: players
    });
  } catch (error) {
    console.error("Error fetching players:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get server queue from ER:LC API
app.get("/api/erlc/queue/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/queue`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const queue = await response.json();

    res.json({
      success: true,
      queue: queue
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get join logs from ER:LC API
app.get("/api/erlc/joinlogs/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/joinlogs`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const logs = await response.json();

    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error("Error fetching join logs:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get kill logs from ER:LC API
app.get("/api/erlc/killlogs/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/killlogs`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const logs = await response.json();

    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error("Error fetching kill logs:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get command logs from ER:LC API
app.get("/api/erlc/commandlogs/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/commandlogs`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const logs = await response.json();

    res.json({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error("Error fetching command logs:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get mod calls from ER:LC API
app.get("/api/erlc/modcalls/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/modcalls`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const modcalls = await response.json();

    res.json({
      success: true,
      modcalls: modcalls
    });
  } catch (error) {
    console.error("Error fetching mod calls:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get bans from ER:LC API
app.get("/api/erlc/bans/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/bans`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const bans = await response.json();

    res.json({
      success: true,
      bans: bans
    });
  } catch (error) {
    console.error("Error fetching bans:", error);
    res.json({ success: false, error: error.message });
  }
});

// Get vehicles from ER:LC API
app.get("/api/erlc/vehicles/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.status(400).json({ error: "Account ID required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/vehicles`, {
      method: 'GET',
      headers: {
        'server-key': server.api_key,
        'Accept': '*/*'
      }
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const vehicles = await response.json();

    res.json({
      success: true,
      vehicles: vehicles
    });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.json({ success: false, error: error.message });
  }
});

// Execute command on ER:LC server
app.post("/api/erlc/command/:serverId", async (req, res) => {
  const { serverId } = req.params;
  const { accountID, command } = req.body;

  if (!accountID || !command) {
    return res.status(400).json({ error: "Account ID and command required" });
  }

  try {
    const result = await pool.query(
      "SELECT api_key FROM servers WHERE id = $1",
      [serverId]
    );

    if (result.rows.length === 0 || !result.rows[0].api_key) {
      return res.json({ success: false, error: "API not configured" });
    }

    const server = result.rows[0];

    const response = await fetch(`https://api.policeroleplay.community/v1/server/command`, {
      method: 'POST',
      headers: {
        'server-key': server.api_key,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify({ command: command })
    });

    if (!response.ok) {
      return res.json({ success: false, error: `API error: ${response.status}` });
    }

    const result_data = await response.json();

    res.json({
      success: true,
      result: result_data
    });
  } catch (error) {
    console.error("Error executing command:", error);
    res.json({ success: false, error: error.message });
  }
});
// ============= DISCORD LINKING API ENDPOINTS =============
// Add these routes to your existing server.js file (before the 404 handler)

// GET /api/servers/user - Get user's servers for dropdown (modified to use owner_account_id)
app.get('/api/servers/user', async (req, res) => {
  const { accountID } = req.query;

  if (!accountID) {
    return res.json({ success: false, error: 'Account ID required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, created_at FROM servers WHERE owner_account_id = $1 ORDER BY created_at DESC`,
      [accountID]
    );

    res.json({
      success: true,
      servers: result.rows
    });
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// POST /api/servers/link - Link Discord server to website server
app.post('/api/servers/link', async (req, res) => {
  const { serverId, code, accountID } = req.body;

  if (!serverId || !code || !accountID) {
    return res.json({ 
      success: false, 
      error: 'Server ID, code, and account ID required' 
    });
  }

  try {
    // 1. Verify code exists and hasn't expired
    const codeResult = await pool.query(
      `SELECT * FROM link_codes 
       WHERE code = $1 AND expires_at > NOW()`,
      [code.toUpperCase()]
    );

    if (codeResult.rows.length === 0) {
      return res.json({ 
        success: false, 
        error: 'Invalid or expired code. Please run /link in Discord again.' 
      });
    }

    const linkData = codeResult.rows[0];

    // 2. Verify server belongs to user
    const serverResult = await pool.query(
      `SELECT * FROM servers 
       WHERE id = $1 AND owner_account_id = $2`,
      [serverId, accountID]
    );

    if (serverResult.rows.length === 0) {
      return res.json({ 
        success: false, 
        error: 'Server not found or access denied' 
      });
    }

    // 3. Check if Discord server is already linked
    const existingLink = await pool.query(
      `SELECT * FROM server_links 
       WHERE discord_guild_id = $1`,
      [linkData.discord_guild_id]
    );

    if (existingLink.rows.length > 0 && existingLink.rows[0].website_server_id !== serverId) {
      return res.json({ 
        success: false, 
        error: 'This Discord server is already linked to another Nexus server.' 
      });
    }

    // 4. Create or update link
    await pool.query(
      `INSERT INTO server_links 
       (website_server_id, discord_guild_id, discord_guild_name, owner_account_id, linked_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (discord_guild_id) 
       DO UPDATE SET 
         website_server_id = $1,
         owner_account_id = $4,
         linked_at = NOW()`,
      [serverId, linkData.discord_guild_id, linkData.discord_guild_name, accountID]
    );

    // 5. Delete used code
    await pool.query(`DELETE FROM link_codes WHERE code = $1`, [code.toUpperCase()]);

    console.log(`✅ Discord server "${linkData.discord_guild_name}" linked to ${serverId}`);

    res.json({ 
      success: true,
      discordGuildName: linkData.discord_guild_name,
      discordGuildId: linkData.discord_guild_id
    });

  } catch (error) {
    console.error('Error linking server:', error);
    res.json({ success: false, error: 'Database error. Please try again.' });
  }
});

// GET /api/servers/:serverId/discord-link - Check if server is linked
app.get('/api/servers/:serverId/discord-link', async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.json({ success: false, error: 'Account ID required' });
  }

  try {
    const serverCheck = await pool.query(
      `SELECT * FROM servers WHERE id = $1 AND owner_account_id = $2`,
      [serverId, accountID]
    );

    if (serverCheck.rows.length === 0) {
      return res.json({ success: false, error: 'Access denied' });
    }

    const linkResult = await pool.query(
      `SELECT * FROM server_links WHERE website_server_id = $1`,
      [serverId]
    );

    if (linkResult.rows.length > 0) {
      res.json({
        success: true,
        linked: true,
        guildId: linkResult.rows[0].discord_guild_id,
        guildName: linkResult.rows[0].discord_guild_name,
        linkedAt: linkResult.rows[0].linked_at
      });
    } else {
      res.json({ success: true, linked: false });
    }
  } catch (error) {
    console.error('Error checking link:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// POST /api/servers/:serverId/unlink-discord
app.post('/api/servers/:serverId/unlink-discord', async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.body;

  if (!accountID) {
    return res.json({ success: false, error: 'Account ID required' });
  }

  try {
    const serverCheck = await pool.query(
      `SELECT * FROM servers WHERE id = $1 AND owner_account_id = $2`,
      [serverId, accountID]
    );

    if (serverCheck.rows.length === 0) {
      return res.json({ success: false, error: 'Access denied' });
    }

    const result = await pool.query(
      `DELETE FROM server_links WHERE website_server_id = $1 RETURNING discord_guild_name`,
      [serverId]
    );

    if (result.rows.length > 0) {
      res.json({ success: true, message: 'Discord server unlinked successfully' });
    } else {
      res.json({ success: false, error: 'No Discord server linked' });
    }
  } catch (error) {
    console.error('Error unlinking:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// GET /api/servers/:serverId/activity - Get activity logs
app.get('/api/servers/:serverId/activity', async (req, res) => {
  const { serverId } = req.params;
  const { accountID } = req.query;

  if (!accountID) {
    return res.json({ success: false, error: 'Account ID required' });
  }

  try {
    const serverCheck = await pool.query(
      `SELECT * FROM servers WHERE id = $1 AND owner_account_id = $2`,
      [serverId, accountID]
    );

    if (serverCheck.rows.length === 0) {
      return res.json({ success: false, error: 'Access denied' });
    }

    const linkResult = await pool.query(
      `SELECT discord_guild_id FROM server_links WHERE website_server_id = $1`,
      [serverId]
    );

    if (linkResult.rows.length === 0) {
      return res.json({ success: true, activity: [] });
    }

    const guildId = linkResult.rows[0].discord_guild_id;
    const activities = [];

    try {
      const sessions = await pool.query(
        `SELECT * FROM sessions WHERE guild_id = $1 ORDER BY timestamp DESC LIMIT 10`,
        [guildId]
      );

      sessions.rows.forEach(s => {
        activities.push({
          type: s.action === 'start' ? 'success' : 'info',
          icon: s.action === 'start' ? 'fa-play' : 'fa-stop',
          message: `${s.username} ${s.action === 'start' ? 'started' : 'ended'} ${s.session_type || ''} session`,
          timeAgo: getTimeAgo(new Date(s.timestamp)),
          timestamp: s.timestamp
        });
      });
    } catch (e) {
      console.log('Sessions table not found');
    }

    try {
      const shifts = await pool.query(
        `SELECT * FROM shifts WHERE guild_id = $1 AND end_time IS NOT NULL ORDER BY end_time DESC LIMIT 10`,
        [guildId]
      );

      shifts.rows.forEach(s => {
        const hours = Math.floor(s.duration_seconds / 3600);
        const minutes = Math.floor((s.duration_seconds % 3600) / 60);
        activities.push({
          type: 'info',
          icon: 'fa-clock',
          message: `${s.username} ended shift as ${s.role} (${hours}h ${minutes}m)`,
          timeAgo: getTimeAgo(new Date(s.end_time)),
          timestamp: s.end_time
        });
      });
    } catch (e) {
      console.log('Shifts table not found');
    }

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, activity: activities.slice(0, 15) });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.json({ success: false, error: 'Database error' });
  }
});

// POST /api/discord/erlc/command - Proxy commands from bot
app.post('/api/discord/erlc/command', async (req, res) => {
  const { guildId, command } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.BOT_API_KEY}`) {
    return res.json({ success: false, error: 'Unauthorized' });
  }

  try {
    const linkResult = await pool.query(
      `SELECT website_server_id FROM server_links WHERE discord_guild_id = $1`,
      [guildId]
    );

    if (linkResult.rows.length === 0) {
      return res.json({ success: false, error: 'Discord server not linked' });
    }

    const serverId = linkResult.rows[0].website_server_id;

    const serverResult = await pool.query(`SELECT api_key FROM servers WHERE id = $1`, [serverId]);

    if (serverResult.rows.length === 0 || !serverResult.rows[0].api_key) {
      return res.json({ success: false, error: 'ER:LC API key not set' });
    }

    const apiKey = serverResult.rows[0].api_key;
    
    const erlcResponse = await fetch(`https://api.policeroleplay.community/v1/server/command`, {
      method: 'POST',
      headers: { 
        'server-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      },
      body: JSON.stringify({ command })
    });

    if (!erlcResponse.ok) {
      return res.json({ success: false, error: `ER:LC API error: ${erlcResponse.status}` });
    }

    const result = await erlcResponse.json();
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending command:', error);
    res.json({ success: false, error: 'Failed to send command' });
  }
});

// POST /api/discord/activity - Log activity from bot
app.post('/api/discord/activity', async (req, res) => {
  const { guildId, type, message } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader !== `Bearer ${process.env.BOT_API_KEY}`) {
    return res.json({ success: false, error: 'Unauthorized' });
  }

  try {
    const linkResult = await pool.query(
      `SELECT website_server_id FROM server_links WHERE discord_guild_id = $1`,
      [guildId]
    );

    if (linkResult.rows.length === 0) {
      return res.json({ success: false, error: 'Not linked' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.json({ success: false, error: 'Failed to log' });
  }
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