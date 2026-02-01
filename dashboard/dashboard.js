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
  console.log("Frontend received user:", user); // Debug log

  // Use safe defaults instead of failing
  const username = user.username || "Unknown";
  const discriminator = user.discriminator || "0000";
  const plan = user.plan || "free";

  localStorage.setItem("sessionToken", token);

  document.getElementById("username").textContent = `${username}#${discriminator}`;
  document.getElementById("displayName").textContent = username;
  document.getElementById("planBadge").textContent = plan;

  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("sessionToken");
    window.location.href = "/logout?token=" + token;
  };
}

loadDashboard();
