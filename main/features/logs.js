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
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  toast.innerHTML = `<div style="background:rgba(26,26,26,0.95);border:1px solid rgba(160,32,240,0.3);border-radius:12px;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;min-width:300px;box-shadow:0 10px 40px rgba(0,0,0,0.5);pointer-events:auto"><div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:${type==='success'?'rgba(34,197,94,0.2)':type==='error'?'rgba(239,68,68,0.2)':'rgba(59,130,246,0.2)'};color:${type==='success'?'#4ade80':type==='error'?'#f87171':'#60a5fa'}"><i class="fa-solid ${icons[type]}"></i></div><div style="flex:1"><div style="color:#fff;font-weight:600">${title}</div>${message?`<div style="color:#999;font-size:0.9rem">${message}</div>`:''}</div><button onclick="this.closest('.toast').remove()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:#999;cursor:pointer"><i class="fa-solid fa-xmark"></i></button></div>`;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
  return toast;
}

function showSuccess(t, m, d) { return showToast('success', t, m, d); }
function showError(t, m, d) { return showToast('error', t, m, d); }
function showLoading(m) { return showToast('info', m, '<div style="width:20px;height:20px;border:2px solid rgba(160,32,240,0.2);border-top-color:#a020f0;border-radius:50%;animation:spin 0.8s linear infinite"></div>', 0); }

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const serverId = getQueryParam('serverId');
const accountID = getQueryParam('accountID') || localStorage.getItem('accountID');

if (accountID && serverId) {
  document.getElementById('dashboardLink').href = `/dashboard/user.html?ID=${accountID}`;
  document.getElementById('serverDashLink').href = `/main/server.html?id=${serverId}&accountID=${accountID}`;
  document.getElementById('serversLink').href = `/main/servers.html?ID=${accountID}`;
}

let allLogs = [];
let currentFilter = 'all';

async function loadServerName() {
  try {
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    const data = await response.json();
    if (data.success) document.getElementById('serverName').textContent = data.server.name;
  } catch (error) {
    console.error('Error loading server name:', error);
  }
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

async function loadAllLogs() {
  const loadingToast = showLoading('Loading logs...');
  allLogs = [];

  try {
    // Load join logs
    const joinResponse = await fetch(`/api/erlc/joinlogs/${serverId}?accountID=${accountID}`);
    const joinData = await joinResponse.json();
    if (joinData.success && joinData.logs) {
      joinData.logs.forEach(log => {
        allLogs.push({
          type: log.Join ? 'join' : 'leave',
          player: log.Player,
          timestamp: log.Timestamp,
          raw: log
        });
      });
    }

    // Load kill logs
    const killResponse = await fetch(`/api/erlc/killlogs/${serverId}?accountID=${accountID}`);
    const killData = await killResponse.json();
    if (killData.success && killData.logs) {
      killData.logs.forEach(log => {
        allLogs.push({
          type: 'kill',
          killer: log.Killer,
          killed: log.Killed,
          timestamp: log.Timestamp,
          raw: log
        });
      });
    }

    // Load command logs
    const commandResponse = await fetch(`/api/erlc/commandlogs/${serverId}?accountID=${accountID}`);
    const commandData = await commandResponse.json();
    if (commandData.success && commandData.logs) {
      commandData.logs.forEach(log => {
        allLogs.push({
          type: 'command',
          player: log.Player,
          command: log.Command,
          timestamp: log.Timestamp,
          raw: log
        });
      });
    }

    // Load mod calls
    const modcallResponse = await fetch(`/api/erlc/modcalls/${serverId}?accountID=${accountID}`);
    const modcallData = await modcallResponse.json();
    if (modcallData.success && modcallData.modcalls) {
      modcallData.modcalls.forEach(log => {
        allLogs.push({
          type: 'modcall',
          caller: log.Caller,
          moderator: log.Moderator,
          timestamp: log.Timestamp,
          raw: log
        });
      });
    }

    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Update stats
    updateStats();
    renderLogs();
    loadingToast.remove();
    showSuccess('Logs Loaded', `${allLogs.length} events loaded`);

  } catch (error) {
    console.error('Error loading logs:', error);
    loadingToast.remove();
    showError('Failed to Load', 'Could not fetch logs');
  }
}

function updateStats() {
  document.getElementById('joinCount').textContent = allLogs.filter(l => l.type === 'join').length;
  document.getElementById('leaveCount').textContent = allLogs.filter(l => l.type === 'leave').length;
  document.getElementById('killCount').textContent = allLogs.filter(l => l.type === 'kill').length;
  document.getElementById('commandCount').textContent = allLogs.filter(l => l.type === 'command').length;
  document.getElementById('modcallCount').textContent = allLogs.filter(l => l.type === 'modcall').length;
}

function renderLogs() {
  const container = document.getElementById('logsList');
  const searchTerm = document.getElementById('searchBox').value.toLowerCase();
  
  let filtered = allLogs;
  if (currentFilter !== 'all') {
    filtered = allLogs.filter(log => log.type === currentFilter);
  }
  
  if (searchTerm) {
    filtered = filtered.filter(log => {
      const searchString = JSON.stringify(log).toLowerCase();
      return searchString.includes(searchTerm);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox" style="font-size:3rem;color:#666"></i><p>No logs found</p></div>';
    return;
  }

  container.innerHTML = filtered.map(log => {
    let content = '';
    let details = '';
    
    switch(log.type) {
      case 'join':
        content = `<strong>${log.player.split(':')[0]}</strong> joined the server`;
        break;
      case 'leave':
        content = `<strong>${log.player.split(':')[0]}</strong> left the server`;
        break;
      case 'kill':
        content = `<strong>${log.killer.split(':')[0]}</strong> killed <strong>${log.killed.split(':')[0]}</strong>`;
        break;
      case 'command':
        content = `<strong>${log.player.split(':')[0]}</strong> executed command`;
        details = `<code style="background:rgba(0,0,0,0.5);padding:0.25rem 0.5rem;border-radius:4px;color:#60a5fa">${log.command}</code>`;
        break;
      case 'modcall':
        content = `Mod call from <strong>${log.caller.split(':')[0]}</strong>`;
        if (log.moderator) details = `Handled by ${log.moderator.split(':')[0]}`;
        break;
    }

    return `
      <div class="log-item ${log.type}">
        <div class="log-header">
          <span class="log-type ${log.type}">
            <i class="fa-solid fa-${log.type === 'join' ? 'right-to-bracket' : log.type === 'leave' ? 'right-from-bracket' : log.type === 'kill' ? 'skull' : log.type === 'command' ? 'terminal' : 'hand'}"></i>
            ${log.type}
          </span>
          <span class="log-time">${formatTimestamp(log.timestamp)}</span>
        </div>
        <p class="log-content">${content}</p>
        ${details ? `<p class="log-details">${details}</p>` : ''}
      </div>
    `;
  }).join('');
}

function filterLogs(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderLogs();
}

function searchLogs() {
  renderLogs();
}

window.addEventListener('load', () => {
  if (!serverId || !accountID) {
    showError('Missing Information', 'Server or account information not found');
    setTimeout(() => window.location.href = '/main/servers.html', 2000);
    return;
  }

  loadServerName();
  loadAllLogs();

  // Auto-refresh every 30 seconds
  setInterval(loadAllLogs, 30000);
});
