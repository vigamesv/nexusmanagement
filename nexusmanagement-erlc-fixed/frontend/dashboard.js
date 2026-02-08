async function loadServer() {
  const serverId = localStorage.getItem("serverId") || "demo-server";

  const res = await fetch(`/api/server/${serverId}`);
  const data = await res.json();

  document.getElementById("serverName").textContent = data.server.Name;
  document.getElementById("playerCount").textContent =
    data.players.length + "/" + data.server.MaxPlayers;
}

async function executeCommand() {
  const serverId = localStorage.getItem("serverId") || "demo-server";
  const command = document.getElementById("serverCommand").value;

  const res = await fetch(`/api/server/${serverId}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });

  document.getElementById("commandResult").textContent =
    JSON.stringify(await res.json(), null, 2);
}

loadServer();
