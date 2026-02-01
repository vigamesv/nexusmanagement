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
  console.log("Frontend received user:", user);

  // Prefer global_name, fallback to username
  const displayName = user.global_name || user.username || "Unknown";
  // Only show discriminator if it's not "0"
  const tag = user.discriminator && user.discriminator !== "0"
    ? `#${user.discriminator}`
    : "";

  localStorage.setItem("sessionToken", token);

  // Top-right corner
  document.getElementById("username").textContent = `${displayName}${tag}`;
  // Welcome message
  document.getElementById("displayName").textContent = displayName;
  // Plan badge
  document.getElementById("planBadge").textContent = user.plan || "free";

  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("sessionToken");
    window.location.href = "/logout?token=" + token;
  };
}

loadDashboard();
