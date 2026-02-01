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

loadServerDashboard();
