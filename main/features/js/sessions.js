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
  toast.innerHTML = `<div style="background:rgba(26,26,26,0.95);border:1px solid rgba(160,32,240,0.3);border-radius:12px;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;min-width:300px;box-shadow:0 10px 40px rgba(0,0,0,0.5);pointer-events:auto"><div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:${type==='success'?'rgba(34,197,94,0.2)':'rgba(59,130,246,0.2)'};color:${type==='success'?'#4ade80':'#60a5fa'}"><i class="fa-solid ${icons[type]}"></i></div><div style="flex:1"><div style="color:#fff;font-weight:600">${title}</div>${message?`<div style="color:#999;font-size:0.9rem">${message}</div>`:''}</div><button onclick="this.closest('.toast').remove()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:#999;cursor:pointer"><i class="fa-solid fa-xmark"></i></button></div>`;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
  return toast;
}

function showSuccess(t, m) { return showToast('success', t, m); }
function showInfo(t, m) { return showToast('info', t, m); }

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

const serverId = getQueryParam('serverId');
const accountID = getQueryParam('accountID') || localStorage.getItem('accountID');

if (accountID && serverId) {
  document.getElementById('dashboardLink').href = `/dashboard/user.html?ID=${accountID}`;
  document.getElementById('serverDashLink').href = `/main/server.html?id=${serverId}&accountID=${accountID}`;
  document.getElementById('serversLink').href = `/main/servers.html?ID=${accountID}`;
}

let currentSession = null;
let sessionTimer = null;
let playerCheckInterval = null;
let sessionHistory = [];

async function loadServerName() {
  try {
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    const data = await response.json();
    if (data.success) document.getElementById('serverName').textContent = data.server.name;
  } catch (error) {
    console.error('Error:', error);
  }
}

function loadHistory() {
  const stored = localStorage.getItem(`session_history_${serverId}`);
  if (stored) {
    sessionHistory = JSON.parse(stored);
    renderHistory();
  }
}

function saveHistory() {
  localStorage.setItem(`session_history_${serverId}`, JSON.stringify(sessionHistory));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('historyList');
  if (sessionHistory.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#666;padding:2rem">No previous sessions</p>';
    return;
  }

  container.innerHTML = sessionHistory.slice(0, 10).map(session => {
    const duration = formatDuration(session.duration);
    const date = new Date(session.endTime).toLocaleDateString();
    const time = new Date(session.endTime).toLocaleTimeString();
    
    return `
      <div class="history-item">
        <div class="history-info">
          <h4>${session.type || 'Session'}</h4>
          <p>${date} at ${time}</p>
          <p style="margin-top:0.25rem">Peak: ${session.peakPlayers} players</p>
        </div>
        <div class="history-stats">
          <div class="history-duration">${duration}</div>
        </div>
      </div>
    `;
  }).join('');
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimer() {
  if (!currentSession) return;
  
  const elapsed = Math.floor((Date.now() - currentSession.startTime) / 1000);
  document.getElementById('sessionDuration').textContent = formatDuration(elapsed);
}

async function updatePlayerCount() {
  try {
    const response = await fetch(`/api/erlc/server-info/${serverId}?accountID=${accountID}`);
    const data = await response.json();
    
    if (data.success && data.serverInfo) {
      const currentPlayers = data.serverInfo.CurrentPlayers || 0;
      document.getElementById('playerCount').textContent = currentPlayers;
      
      if (currentSession && currentPlayers > currentSession.peakPlayers) {
        currentSession.peakPlayers = currentPlayers;
        document.getElementById('peakPlayers').textContent = currentPlayers;
        saveCurrentSession();
      }
    }
  } catch (error) {
    console.error('Error fetching player count:', error);
  }
}

function saveCurrentSession() {
  if (currentSession) {
    localStorage.setItem(`current_session_${serverId}`, JSON.stringify(currentSession));
  }
}

function loadCurrentSession() {
  const stored = localStorage.getItem(`current_session_${serverId}`);
  if (stored) {
    currentSession = JSON.parse(stored);
    resumeSession();
  }
}

function startSession() {
  currentSession = {
    startTime: Date.now(),
    peakPlayers: 0,
    type: 'SSU Session'
  };
  
  saveCurrentSession();
  
  document.getElementById('sessionStatus').textContent = 'Session Active';
  document.getElementById('sessionStatus').className = 'status-badge active';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('endBtn').style.display = 'flex';
  document.getElementById('peakPlayers').textContent = '0';
  
  sessionTimer = setInterval(updateTimer, 1000);
  playerCheckInterval = setInterval(updatePlayerCount, 5000);
  
  updatePlayerCount();
  showSuccess('Session Started', 'Session timer is now running');
}

function resumeSession() {
  document.getElementById('sessionStatus').textContent = 'Session Active';
  document.getElementById('sessionStatus').className = 'status-badge active';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('endBtn').style.display = 'flex';
  document.getElementById('peakPlayers').textContent = currentSession.peakPlayers;
  
  sessionTimer = setInterval(updateTimer, 1000);
  playerCheckInterval = setInterval(updatePlayerCount, 5000);
  
  updateTimer();
  updatePlayerCount();
}

async function endSession() {
  if (!currentSession) return;
  
  const duration = Math.floor((Date.now() - currentSession.startTime) / 1000);
  
  // Send :shutdown command to server
  const loadingToast = showInfo('Ending Session', 'Sending shutdown command to server...');
  
  try {
    const response = await fetch(`/api/erlc/command/${serverId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountID: accountID,
        command: ':shutdown'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Shutdown command sent successfully');
      loadingToast.remove();
      showSuccess('Shutdown Command Sent', 'Server shutdown initiated');
    } else {
      console.error('❌ Failed to send shutdown command:', data.error);
      loadingToast.remove();
      showInfo('Session Ended', 'Could not send shutdown command, but session ended');
    }
  } catch (error) {
    console.error('Error sending shutdown command:', error);
    loadingToast.remove();
    showInfo('Session Ended', 'Session ended locally');
  }
  
  // Save to history
  sessionHistory.unshift({
    ...currentSession,
    endTime: Date.now(),
    duration: duration
  });
  
  saveHistory();
  
  clearInterval(sessionTimer);
  clearInterval(playerCheckInterval);
  
  localStorage.removeItem(`current_session_${serverId}`);
  currentSession = null;
  
  document.getElementById('sessionStatus').textContent = 'No Active Session';
  document.getElementById('sessionStatus').className = 'status-badge inactive';
  document.getElementById('startBtn').style.display = 'flex';
  document.getElementById('endBtn').style.display = 'none';
  document.getElementById('sessionDuration').textContent = '00:00:00';
  document.getElementById('playerCount').textContent = '--';
  document.getElementById('peakPlayers').textContent = '0';
  
  showSuccess('Session Ended', `Duration: ${formatDuration(duration)}`);
}

window.addEventListener('load', () => {
  if (!serverId || !accountID) {
    setTimeout(() => window.location.href = '/main/servers.html', 2000);
    return;
  }

  loadServerName();
  loadHistory();
  loadCurrentSession();
});

window.addEventListener('beforeunload', () => {
  if (sessionTimer) clearInterval(sessionTimer);
  if (playerCheckInterval) clearInterval(playerCheckInterval);
});