require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ---- mock auth middleware (REPLACE with real auth) ----
app.use((req, res, next) => {
  req.user = { account_id: "dev_account_123" };
  next();
});

async function getServerAccess(serverId, accountId) {
  const { rows } = await db.query(
    `
    SELECT erlc_server_id, api_key
    FROM servers
    WHERE id = $1
      AND (
        owner_account_id = $2
        OR $1 = ANY(
          SELECT unnest(server_ids) FROM users WHERE account_id = $2
        )
      )
    `,
    [serverId, accountId]
  );

  if (!rows.length) throw new Error("Unauthorized or server not found");
  if (!rows[0].api_key) throw new Error("ER:LC API key not configured");

  return rows[0];
}

app.post("/api/server/:id/settings", async (req, res) => {
  const { apiKey, erlcServerId, name, description } = req.body;
  const { id } = req.params;

  if (!apiKey?.startsWith("PRC_")) {
    return res.status(400).json({ error: "Invalid ER:LC API key" });
  }

  await db.query(
    `
    UPDATE servers
    SET api_key = $1,
        erlc_server_id = $2,
        name = $3,
        description = $4,
        updated_at = NOW()
    WHERE id = $5 AND owner_account_id = $6
    `,
    [apiKey, erlcServerId, name, description, id, req.user.account_id]
  );

  res.json({ success: true });
});

app.get("/api/server/:id", async (req, res) => {
  try {
    const { erlc_server_id, api_key } =
      await getServerAccess(req.params.id, req.user.account_id);

    const headers = { Authorization: api_key };

    const [server, players] = await Promise.all([
      axios.get(
        `https://api.policeroleplay.community/v1/server/${erlc_server_id}`,
        { headers }
      ),
      axios.get(
        `https://api.policeroleplay.community/v1/server/${erlc_server_id}/players`,
        { headers }
      ),
    ]);

    res.json({ server: server.data, players: players.data });
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

app.post("/api/server/:id/command", async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "Command required" });

    const { erlc_server_id, api_key } =
      await getServerAccess(req.params.id, req.user.account_id);

    const response = await axios.post(
      `https://api.policeroleplay.community/v1/server/${erlc_server_id}/command`,
      { command },
      { headers: { Authorization: api_key } }
    );

    res.json({ success: true, response: response.data });
  } catch {
    res.status(403).json({ error: "Command execution failed" });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Backend running")
);
