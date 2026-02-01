async function loadServers() {
  const token = localStorage.getItem("sessionToken");
  if (!token) {
    window.location.href = "/";
    return;
  }

  const res = await fetch("/api/servers", {
    headers: { Authorization: token }
  });

  if (!res.ok) {
    alert("Session expired. Please log in again.");
    window.location.href = "/";
    return;
  }

  const servers = await res.json();
  console.log("Servers object from API:", servers);

  const serverList = document.getElementById("serverList");
  if (servers.length === 0) {
    serverList.innerHTML = "<p>You don’t own any servers yet.</p>";
  } else {
    serverList.innerHTML = servers.map(s => `
      <div class="server-card">
        <h3>${s.name}</h3>
        <p>Plan: ${s.plan}</p>
        <p>Staff Count: ${s.staffCount}</p>
        <button onclick="manageServer('${s.id}')">Manage</button>
        <button onclick="settingsServer('${s.id}')">Settings</button>
      </div>
    `).join("");
  }
}

function manageServer(id) {
  window.location.href = `/server.html?id=${id}`;
}

function settingsServer(id) {
  window.location.href = `/settings.html?id=${id}`;
}

document.getElementById("createServerBtn").onclick = () => {
  window.location.href = "/create-server.html";
};

loadServers();
