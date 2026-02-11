// Toast functions
function initToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:1rem;pointer-events:none';
    document.body.appendChild(container);
  }
}

function showToast(type, title, message, duration = 4000) {
  initToastContainer();
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<div style="background:rgba(26,26,26,0.95);border:1px solid rgba(160,32,240,0.3);border-radius:12px;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;min-width:300px;box-shadow:0 10px 40px rgba(0,0,0,0.5);pointer-events:auto;animation:slideIn 0.3s ease"><div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:${type==='success'?'rgba(34,197,94,0.2)':type==='error'?'rgba(239,68,68,0.2)':'rgba(59,130,246,0.2)'};color:${type==='success'?'#4ade80':type==='error'?'#f87171':'#60a5fa'}"><i class="fa-solid ${icons[type]}"></i></div><div style="flex:1"><div style="color:#fff;font-weight:600;font-size:1rem;margin:0 0 0.25rem 0">${title}</div>${message?`<div style="color:#999;font-size:0.9rem;margin:0">${message}</div>`:''}</div><button onclick="this.closest('.toast').remove()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:#999;cursor:pointer"><i class="fa-solid fa-xmark"></i></button></div>`;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
  return toast;
}

function showSuccess(t, m, d) { return showToast('success', t, m, d); }
function showError(t, m, d) { return showToast('error', t, m, d); }
function showLoading(m) { return showToast('info', m, '<div style="width:20px;height:20px;border:2px solid rgba(160,32,240,0.2);border-top-color:#a020f0;border-radius:50%;animation:spin 0.8s linear infinite"></div>', 0); }

// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const serverId = getQueryParam('serverId');
const accountID = getQueryParam('accountID') || localStorage.getItem('accountID');

// Update nav links
if (accountID && serverId) {
  document.getElementById('dashboardLink').href = `/dashboard/user.html?ID=${accountID}`;
  document.getElementById('serverDashLink').href = `/main/server.html?id=${serverId}&accountID=${accountID}`;
  document.getElementById('serversLink').href = `/main/servers.html?ID=${accountID}`;
}

// Global data
let currentData = {
  serverInfo: null,
  players: [],
  staff: [],
  queue: []
};

// Load server name
async function loadServerName() {
  try {
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    const data = await response.json();
    if (data.success) {
      document.getElementById('serverName').textContent = data.server.name;
    }
  } catch (error) {
    console.error('Error loading server name:', error);
  }
}

// Get team badge class
function getTeamBadge(team) {
  const teamLower = team.toLowerCase();
  if (teamLower.includes('police')) return 'team-police';
  if (teamLower.includes('sheriff')) return 'team-sheriff';
  if (teamLower.includes('fire')) return 'team-fire';
  if (teamLower.includes('dot')) return 'team-dot';
  return 'team-civilian';
}

// Get permission badge
function getPermissionBadge(permission) {
  if (permission.includes('Owner')) return 'permission-admin';
  if (permission.includes('Administrator')) return 'permission-admin';
  if (permission.includes('Moderator')) return 'permission-mod';
  return 'permission-badge';
}

// Load all data
async function loadAllData() {
  const refreshIcon = document.getElementById('refreshIcon');
  refreshIcon.classList.add('loading');

  try {
    // Load server info
    const infoResponse = await fetch(`/api/erlc/server-info/${serverId}?accountID=${accountID}`);
    const infoData = await infoResponse.json();
    
    if (infoData.success && infoData.serverInfo) {
      currentData.serverInfo = infoData.serverInfo;
      
      // Update overview stats
      const players = infoData.serverInfo.CurrentPlayers || 0;
      const maxPlayers = infoData.serverInfo.MaxPlayers || 0;
      document.getElementById('totalPlayers').textContent = `${players}/${maxPlayers}`;
      document.getElementById('currentMap').textContent = infoData.serverInfo.MapName || 'Unknown';
    }

    // Load players
    const playersResponse = await fetch(`/api/erlc/players/${serverId}?accountID=${accountID}`);
    const playersData = await playersResponse.json();
    
    if (playersData.success && playersData.players) {
      currentData.players = playersData.players;
      renderPlayers();
    }

    // Load staff
    const staffResponse = await fetch(`/api/erlc/staff/${serverId}?accountID=${accountID}`);
    const staffData = await staffResponse.json();
    
    if (staffData.success && staffData.staff) {
      currentData.staff = staffData.staff;
      const onlineStaff = staffData.staff.filter(s => s.IsOnline).length;
      document.getElementById('staffOnline').textContent = `${onlineStaff}/${staffData.staff.length}`;
      renderStaff();
    }

    // Load queue
    const queueResponse = await fetch(`/api/erlc/queue/${serverId}?accountID=${accountID}`);
    const queueData = await queueResponse.json();
    
    if (queueData.success && queueData.queue) {
      currentData.queue = queueData.queue;
      document.getElementById('queueCount').textContent = queueData.queue.length || 0;
    }

  } catch (error) {
    console.error('Error loading data:', error);
    showError('Failed to Load', 'Could not fetch server data');
  } finally {
    refreshIcon.classList.remove('loading');
  }
}

// Render players
function renderPlayers() {
  const container = document.getElementById('playersList');
  
  if (currentData.players.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox" style="font-size:3rem;color:#666"></i><p>No players online</p></div>';
    return;
  }

  container.innerHTML = currentData.players.map(player => {
    const [name, id] = player.Player.split(':');
    const teamBadge = getTeamBadge(player.Team);
    const initial = name.charAt(0).toUpperCase();
    
    return `
      <div class="player-card">
        <div class="player-avatar">${initial}</div>
        <div class="player-info">
          <div class="player-name">${name}</div>
          <div class="player-details">
            <span class="team-badge ${teamBadge}">${player.Team}</span>
            ${player.Callsign ? `<span style="color:#999">• ${player.Callsign}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render staff
function renderStaff() {
  const container = document.getElementById('staffList');
  
  if (currentData.staff.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox" style="font-size:3rem;color:#666"></i><p>No staff members</p></div>';
    return;
  }

  container.innerHTML = currentData.staff.map(staff => {
    const [name, id] = staff.Player.split(':');
    const initial = name.charAt(0).toUpperCase();
    const permissionClass = getPermissionBadge(staff.Permission);
    const statusClass = staff.IsOnline ? 'status-online' : 'status-offline';
    const statusIcon = staff.IsOnline ? 'fa-circle' : 'fa-circle';
    
    return `
      <div class="staff-card">
        <div class="staff-avatar">${initial}</div>
        <div class="staff-info">
          <div class="staff-name">${name}</div>
          <div class="staff-details">
            <span class="permission-badge ${permissionClass}">${staff.Permission}</span>
            <span class="${statusClass}"><i class="fa-solid ${statusIcon}"></i> ${staff.IsOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Initialize
window.addEventListener('load', () => {
  if (!serverId || !accountID) {
    showError('Missing Information', 'Server or account information not found');
    setTimeout(() => window.location.href = '/main/servers.html', 2000);
    return;
  }

  loadServerName();
  loadAllData();

  // Auto-refresh every 10 seconds
  setInterval(loadAllData, 10000);
});
