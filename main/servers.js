// Get account ID from URL
function getAccountID() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('ID') || localStorage.getItem('accountID');
}

// Store account ID in localStorage for persistence
const accountID = getAccountID();
if (accountID) {
  localStorage.setItem('accountID', accountID);
  // Update dashboard link
  const dashboardLink = document.getElementById('dashboardLink');
  if (dashboardLink) {
    dashboardLink.href = `/dashboard/user.html?ID=${accountID}`;
  }
}

// Global variables
let currentUser = null;
let ownedServers = [];
let memberServers = [];

// Load user data and servers on page load
async function loadUserAndServers() {
  if (!accountID) {
    showError("No account ID found. Please log in again.");
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    return;
  }

  try {
    // Fetch user data
    const userRes = await fetch(`/api/user/${accountID}`);
    const userData = await userRes.json();

    if (!userData.success) {
      throw new Error(userData.error || 'Failed to load user data');
    }

    currentUser = userData.user;

    // Parse server IDs
    const ownedServerIds = currentUser.owned_server_ids || [];
    const memberServerIds = currentUser.server_ids || [];

    // Update stats
    document.getElementById('ownedCount').textContent = ownedServerIds.length;
    document.getElementById('memberCount').textContent = memberServerIds.length;
    document.getElementById('totalCount').textContent = ownedServerIds.length + memberServerIds.length;

    // For now, create mock server data since we don't have a servers table yet
    // In production, you'd fetch from /api/servers endpoint
    ownedServers = ownedServerIds.map((id, index) => ({
      id: id,
      name: `Server ${index + 1}`,
      description: 'ER:LC Community Server',
      plan: 'Free',
      staffCount: 0,
      createdAt: new Date().toISOString()
    }));

    memberServers = memberServerIds.map((id, index) => ({
      id: id,
      name: `Community Server ${index + 1}`,
      description: 'You are a member of this server',
      plan: 'Free',
      staffCount: 0,
      owner: 'Server Owner'
    }));

    // Display servers
    displayOwnedServers();
    displayMemberServers();

  } catch (error) {
    console.error('Error loading user data:', error);
    showError('Failed to load server data. Please try again.');
  }
}

// Display owned servers
function displayOwnedServers() {
  const container = document.getElementById('ownedServers');

  if (ownedServers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <h3>No Servers Yet</h3>
        <p>Create your first server to get started with staff management</p>
        <button class="create-btn" onclick="showCreateModal()">
          <i class="fa-solid fa-plus"></i> Create Server
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = ownedServers.map(server => `
    <div class="server-card" data-server-id="${server.id}">
      <div class="server-header">
        <div class="server-icon owner">
          <i class="fa-solid fa-crown"></i>
        </div>
        <h3>${escapeHtml(server.name)}</h3>
      </div>
      <div class="server-body">
        <p class="server-desc">${escapeHtml(server.description)}</p>
        <div class="server-meta">
          <span class="meta-item">
            <i class="fa-solid fa-tag"></i> ${server.plan}
          </span>
          <span class="meta-item">
            <i class="fa-solid fa-users"></i> ${server.staffCount} Staff
          </span>
        </div>
      </div>
      <div class="server-actions">
        <button class="action-btn primary" onclick="manageServer('${server.id}')">
          <i class="fa-solid fa-cog"></i> Manage
        </button>
        <button class="action-btn secondary" onclick="viewServerDetails('${server.id}', 'owned')">
          <i class="fa-solid fa-info-circle"></i> Details
        </button>
      </div>
    </div>
  `).join('');
}

// Display member servers
function displayMemberServers() {
  const container = document.getElementById('memberServers');

  if (memberServers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <h3>Not a Member Yet</h3>
        <p>You haven't been added to any servers as a staff member</p>
      </div>
    `;
    return;
  }

  container.innerHTML = memberServers.map(server => `
    <div class="server-card" data-server-id="${server.id}">
      <div class="server-header">
        <div class="server-icon member">
          <i class="fa-solid fa-user"></i>
        </div>
        <h3>${escapeHtml(server.name)}</h3>
      </div>
      <div class="server-body">
        <p class="server-desc">${escapeHtml(server.description)}</p>
        <div class="server-meta">
          <span class="meta-item">
            <i class="fa-solid fa-user-shield"></i> ${server.owner}
          </span>
          <span class="meta-item">
            <i class="fa-solid fa-users"></i> ${server.staffCount} Staff
          </span>
        </div>
      </div>
      <div class="server-actions">
        <button class="action-btn primary" onclick="viewServerDetails('${server.id}', 'member')">
          <i class="fa-solid fa-eye"></i> View
        </button>
      </div>
    </div>
  `).join('');
}

// Create new server
document.getElementById('createServerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const serverName = document.getElementById('serverName').value.trim();
  const serverDescription = document.getElementById('serverDescription').value.trim();

  if (!serverName) {
    showError('Please enter a server name');
    return;
  }

  try {
    // Generate a unique server ID
    const serverId = `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // In production, you would POST to /api/servers/create
    // For now, we'll update the user's owned_server_ids array
    const currentOwned = currentUser.owned_server_ids || [];
    currentOwned.push(serverId);

    // Update user in database (you'll need to create this endpoint)
    const response = await fetch(`/api/user/${accountID}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owned_server_ids: currentOwned
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create server');
    }

    // Show success message
    showSuccess('Server created successfully!');
    closeCreateModal();

    // Reload servers
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (error) {
    console.error('Error creating server:', error);
    showError('Failed to create server. Please try again.');
  }
});

// Manage server
function manageServer(serverId) {
  // Navigate to server dashboard
  window.location.href = `/main/server.html?id=${serverId}&accountID=${accountID}`;
}

// View server details
function viewServerDetails(serverId, type) {
  const server = type === 'owned' 
    ? ownedServers.find(s => s.id === serverId)
    : memberServers.find(s => s.id === serverId);

  if (!server) return;

  const modal = document.getElementById('serverModal');
  const modalBody = document.getElementById('serverModalBody');
  const modalTitle = document.getElementById('modalServerName');
  const manageBtn = document.getElementById('manageServerBtn');

  modalTitle.innerHTML = `<i class="fa-solid fa-server"></i> ${escapeHtml(server.name)}`;

  modalBody.innerHTML = `
    <div class="server-details">
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-id-card"></i> Server ID:</span>
        <span class="detail-value">${serverId}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-align-left"></i> Description:</span>
        <span class="detail-value">${escapeHtml(server.description)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-tag"></i> Plan:</span>
        <span class="detail-value">${server.plan}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-users"></i> Staff Count:</span>
        <span class="detail-value">${server.staffCount}</span>
      </div>
      ${type === 'owned' ? `
        <div class="detail-row">
          <span class="detail-label"><i class="fa-solid fa-calendar"></i> Created:</span>
          <span class="detail-value">${new Date(server.createdAt).toLocaleDateString()}</span>
        </div>
      ` : `
        <div class="detail-row">
          <span class="detail-label"><i class="fa-solid fa-user-shield"></i> Owner:</span>
          <span class="detail-value">${escapeHtml(server.owner)}</span>
        </div>
      `}
    </div>
  `;

  if (type === 'owned') {
    manageBtn.style.display = 'inline-block';
    manageBtn.onclick = () => manageServer(serverId);
  } else {
    manageBtn.style.display = 'none';
  }

  modal.style.display = 'block';
}

// Modal functions
function showCreateModal() {
  document.getElementById('createModal').style.display = 'block';
  document.getElementById('serverName').focus();
}

function closeCreateModal() {
  document.getElementById('createModal').style.display = 'none';
  document.getElementById('createServerForm').reset();
}

function closeServerModal() {
  document.getElementById('serverModal').style.display = 'none';
}

// Close modals when clicking outside
window.onclick = function(event) {
  const createModal = document.getElementById('createModal');
  const serverModal = document.getElementById('serverModal');
  
  if (event.target === createModal) {
    closeCreateModal();
  }
  if (event.target === serverModal) {
    closeServerModal();
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  // You can implement a toast notification system here
  alert(message);
}

function showSuccess(message) {
  // You can implement a toast notification system here
  alert(message);
}

// Scroll reveal animation
function revealOnScroll() {
  const reveals = document.querySelectorAll('.reveal');
  reveals.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight - 100;
    if (isVisible) {
      setTimeout(() => {
        el.classList.add('active');
      }, index * 100);
    }
  });
}

window.addEventListener('scroll', revealOnScroll);

// Initialize on page load
window.addEventListener('load', () => {
  loadUserAndServers();
  revealOnScroll();
  
  // Fade in animation
  const fadeElements = document.querySelectorAll('.fade-in');
  fadeElements.forEach(el => {
    el.classList.add('active');
  });
});
