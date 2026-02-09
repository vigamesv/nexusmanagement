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
    showError("Missing Account", "No account ID found. Please log in again.");
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    return;
  }

  try {
    console.log('🔄 Loading servers for account:', accountID);
    
    // Fetch servers from backend
    const response = await fetch(`/api/servers/user/${accountID}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to load servers');
    }

    console.log('✅ Servers loaded:', data);

    ownedServers = data.ownedServers || [];
    memberServers = data.memberServers || [];

    // Update stats
    document.getElementById('ownedCount').textContent = ownedServers.length;
    document.getElementById('memberCount').textContent = memberServers.length;
    document.getElementById('totalCount').textContent = ownedServers.length + memberServers.length;

    // Display servers
    displayOwnedServers();
    displayMemberServers();

  } catch (error) {
    console.error('❌ Error loading servers:', error);
    showError('Failed to Load Servers', 'Could not load server data. Please try again.');
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
        <p class="server-desc">${escapeHtml(server.description || 'ER:LC Community Server')}</p>
        <div class="server-meta">
          <span class="meta-item">
            <i class="fa-solid fa-tag"></i> ${server.plan === 'Free' ? 'Nexus' : 'Nexus+'}
          </span>
          <span class="meta-item">
            <i class="fa-solid fa-users"></i> ${server.staffCount || 0} Staff
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
        <p class="server-desc">${escapeHtml(server.description || 'ER:LC Community Server')}</p>
        <div class="server-meta">
          <span class="meta-item">
            <i class="fa-solid fa-user-shield"></i> ${server.owner || 'Server Owner'}
          </span>
          <span class="meta-item">
            <i class="fa-solid fa-users"></i> ${server.staffCount || 0} Staff
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
  const serverApiKey = document.getElementById('serverApiKey').value.trim();

  if (!serverName) {
    showError('Empty Name', 'Please enter a server name');
    return;
  }

  try {
    console.log('📝 Creating server:', serverName);
    
    // Generate a unique server ID
    const serverId = `SRV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const loadingToast = showLoading('Creating server...');

    // Create server in database
    const response = await fetch(`/api/servers/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverId,
        name: serverName,
        apiKey: serverApiKey || null,
        accountID: accountID
      })
    });

    const data = await response.json();
    
    loadingToast.remove();

    console.log('📊 Server creation response:', data);

    if (!data.success) {
      const errorCode = data.code || 'UNKNOWN';
      showError('Creation Failed', `${data.error || 'Failed to create server'} [${errorCode}]`);
      return;
    }

    // Show success message
    showSuccess(
      'Server Created', 
      serverApiKey ? 'Server created with API key configured!' : 'Server created successfully!'
    );
    
    closeCreateModal();

    // Reload servers
    setTimeout(() => {
      loadUserAndServers();
    }, 1000);

  } catch (error) {
    console.error('❌ Error creating server:', error);
    showError('Creation Error', 'Failed to create server. Please try again.');
  }
});

// Manage server
function manageServer(serverId) {
  console.log('🔧 Managing server:', serverId);
  // Navigate to server dashboard
  window.location.href = `/main/server.html?id=${serverId}&accountID=${accountID}`;
}

// View server details
function viewServerDetails(serverId, type) {
  const server = type === 'owned' 
    ? ownedServers.find(s => s.id === serverId)
    : memberServers.find(s => s.id === serverId);

  if (!server) {
    showError('Server Not Found', 'Could not find server details');
    return;
  }

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
        <span class="detail-value">${escapeHtml(server.description || 'ER:LC Community Server')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-tag"></i> Plan:</span>
        <span class="detail-value">${server.plan === 'Free' ? 'Nexus' : 'Nexus+'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label"><i class="fa-solid fa-users"></i> Staff Count:</span>
        <span class="detail-value">${server.staffCount || 0}</span>
      </div>
      ${type === 'owned' ? `
        <div class="detail-row">
          <span class="detail-label"><i class="fa-solid fa-calendar"></i> Created:</span>
          <span class="detail-value">${new Date(server.createdAt).toLocaleDateString()}</span>
        </div>
      ` : `
        <div class="detail-row">
          <span class="detail-label"><i class="fa-solid fa-user-shield"></i> Owner:</span>
          <span class="detail-value">${escapeHtml(server.owner || 'Unknown')}</span>
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
  console.log('🚀 Servers page initialized');
  console.log('   Account ID:', accountID);
  
  loadUserAndServers();
  revealOnScroll();
  
  // Fade in animation
  const fadeElements = document.querySelectorAll('.fade-in');
  fadeElements.forEach(el => {
    el.classList.add('active');
  });
});