async function loadServerDashboard() {
  const token = localStorage.getItem("sessionToken");
  const urlParams = new URLSearchParams(window.location.search);
  const serverId = urlParams.get("id");

  if (!token || !serverId) {
    window.location.href = "/";
    return;
  }

  const res = await fetch(`/api/server/${serverId}`, {
    headers: { Authorization: token }
  });

  if (!res.ok) {
    alert("Error loading server.");
    window.location.href = "/servers.html";
    return;
  }

  const server = await res.json();
  console.log("Server object from API:", server);

  document.getElementById("serverName").textContent = server.name;
  document.getElementById("planBadge").textContent = server.plan;
  document.getElementById("staffCount").textContent = server.staffCount;
  document.getElementById("activeInfractions").textContent = server.activeInfractions;

  const logsList = document.getElementById("logsList");
  logsList.innerHTML = server.logs.map(l => `<p>${l}</p>`).join("");
}

function addStaff() {
  alert("Add Staff tool coming soon!");
}

function manageInfractions() {
  alert("Manage Infractions tool coming soon!");
}
// Get all servers owned by the logged-in user
app.get("/api/servers", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const servers = await db.get(`servers:${userId}`) || [];
  res.json(servers);
});

// Get a specific server
app.get("/api/server/:id", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const servers = await db.get(`servers:${userId}`) || [];
  const server = servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).send("Server not found");
  res.json(server);
});

// Create a new server
app.post("/create-server", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { name, plan } = req.body;

  let servers = await db.get(`servers:${userId}`) || [];

  const newServer = {
    id: Math.random().toString(36).substring(2, 10), // random short ID
    name,
    plan: plan || "free",
    staffCount: 0,
    activeInfractions: 0,
    logs: []
  };

  servers.push(newServer);
  await db.set(`servers:${userId}`, servers);

  res.json(newServer);
});


loadServerDashboard();
