async function loadDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  if (!token) {
    alert("No session token found. Please log in again.");
    window.location.href = "/";
    return;
  }

  const res = await fetch("/api/user", {
    headers: { Authorization: token }
  });

  if (!res.ok) {
    alert("Session expired. Please log in again.");
    window.location.href = "/";
    return;
  }

  const user = await res.json();

  // Safe defaults
  const username = user?.username || "Unknown";
  const discriminator = user?.discriminator || "0000";
  const plan = user?.plan || "free";

  document.getElementById("username").textContent = `${username}#${discriminator}`;
  document.getElementById("displayName").textContent = username;
  document.getElementById("planBadge").textContent = plan;

  document.getElementById("infractionsCount").textContent = user?.infractions || 0;
  document.getElementById("promotionsCount").textContent = user?.promotions || 0;
  document.getElementById("announcementsCount").textContent = user?.announcements || 0;

  document.getElementById("logoutBtn").onclick = () => {
    window.location.href = "/logout?token=" + token;
  };
}

loadDashboard();
