async function loadServerDashboard() {
  const token = localStorage.getItem("sessionToken");
  const urlParams = new URLSearchParams(window.location.search);
  const serverId = urlParams.get("id");

  //if (!token || !serverId) {
  //  window.location.href = "/";
  //  return;
  //}

  const res = await fetch(`/api/server/${serverId}`, {
    headers: { Authorization: token }
  });

  //if (!res.ok) {
  //  alert("Error loading server.");
  //  window.location.href = "/main/servers.html";
  //  return;
  //}

  const server = await res.json();

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

function authMiddleware(req, res, next) {
  // TEMPORARY: disable authentication
  req.user = { id: "test-user" }; // fake user object
  next();
  app.get("/api/servers", authMiddleware, async (req, res) => {
    const userId = req.user.id; // always "test-user"
    const servers = await db.get(`servers:${userId}`) || [];
    res.json(servers);
  });

}



loadServerDashboard();
