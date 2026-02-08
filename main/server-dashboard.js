// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const serverId = getQueryParam('id');
const accountID = getQueryParam('accountID') || localStorage.getItem('accountID');

// Store accountID for persistence
if (accountID) {
  localStorage.setItem('accountID', accountID);
}

// Update nav links
if (accountID) {
  const dashLink = document.getElementById('dashboardLink');
  const serversLink = document.getElementById('serversLink');
  const settingsLink = document.getElementById('settingsLink');
  
  if (dashLink) dashLink.href = `/dashboard/user.html?ID=${accountID}`;
  if (serversLink) serversLink.href = `/main/servers.html?ID=${accountID}`;
  if (settingsLink) settingsLink.href = `/main/server-settings.html?id=${serverId}&accountID=${accountID}`;
}

// Global variables
let serverData = null;
let commandHistory = [];

// Load server data on page load
async function loadServerData() {
  if (!serverId || !accountID) {
    alert('Missing server or account information');
    window.location.href = `/main/servers.html?ID=${accountID}`;
    return;
  }

  try {
    console.log('Loading server data for:', serverId);
    
    // Fetch server info from database
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    console.log('Server settings response status:', response.status);
    
    const data = await response.json();
    console.log('Server settings data:', data);

    if (data.success) {
      serverData = data.server;
      
      // Update page title and header
      const serverNameEl = document.getElementById('serverName');
      if (serverNameEl) {
        serverNameEl.textContent = serverData.name || 'Server Dashboard';
        document.title = `${serverData.name} - Nexus Management`;
      }
      
      // Update server info
      const serverIdEl = document.getElementById('infoServerId');
      const planEl = document.getElementById('infoPlan');
      
      if (serverIdEl) serverIdEl.textContent = serverData.id;
      if (planEl) planEl.textContent = serverData.plan === 'Free' ? 'Nexus' : 'Nexus+';
      
      // Check if API is configured
      if (serverData.apiKey === true) {
        console.log('API is configured, loading live data...');
        const apiStatusEl = document.getElementById('infoApiStatus');
        if (apiStatusEl) {
          apiStatusEl.innerHTML = '<span class="status-dot online"></span> Connected';
        }
        loadLiveData();
      } else {
        console.log('API not configured');
        const apiStatusEl = document.getElementById('infoApiStatus');
        if (apiStatusEl) {
          apiStatusEl.innerHTML = '<span class="status-dot offline"></span> Not Configured';
        }
        showApiNotConfigured();
      }
    } else {
      throw new Error(data.error || 'Failed to load server');
    }
  } catch (error) {
    console.error('Error loading server:', error);
    alert('Failed to load server data. Redirecting to servers page...');
    setTimeout(() => {
      window.location.href = `/main/servers.html?ID=${accountID}`;
    }, 2000);
  }
}

// Load live data from ER:LC API
async function loadLiveData() {
  try {
    console.log('Fetching live server info...');
    const response = await fetch(`/api/erlc/server-info/${serverId}?accountID=${accountID}`);
    const data = await response.json();
    console.log('Server info response:', data);

    if (data.success && data.serverInfo) {
      const info = data.serverInfo;
      
      // Update status
      const statusBadge = document.getElementById('serverStatus');
      if (statusBadge) {
        statusBadge.className = 'status-badge online';
        statusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Server Online';
      }
      
      // Update stats
      const playersEl = document.getElementById('playersOnline');
      const mapEl = document.getElementById('currentMap');
      const ownerEl = document.getElementById('infoOwner');
      
      if (playersEl) playersEl.textContent = `${info.CurrentPlayers || 0}/${info.MaxPlayers || 0}`;
      if (mapEl) mapEl.textContent = info.MapName || 'Unknown';
      if (ownerEl) ownerEl.textContent = info.OwnerUsername || 'Unknown';
      
      // Calculate uptime (mock for now)
      const uptimeEl = document.getElementById('uptime');
      if (uptimeEl) uptimeEl.textContent = '2h 34m';
      
      // Fetch staff count
      loadStaffCount();
      
      // Load activity
      loadRecentActivity();
    } else {
      // Server offline or API error
      console.error('Server offline or API error:', data.error);
      const statusBadge = document.getElementById('serverStatus');
      if (statusBadge) {
        statusBadge.className = 'status-badge offline';
        statusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Server Offline';
      }
    }
  } catch (error) {
    console.error('Error loading live data:', error);
  }
}

// Load staff count
async function loadStaffCount() {
  try {
    const response = await fetch(`/api/erlc/staff/${serverId}?accountID=${accountID}`);
    const data = await response.json();
    
    if (data.success && data.staff) {
      // Count online staff
      const onlineStaff = data.staff.filter(s => s.IsOnline).length;
      const staffEl = document.getElementById('staffOnline');
      if (staffEl) staffEl.textContent = `${onlineStaff}/${data.staff.length}`;
    } else {
      const staffEl = document.getElementById('staffOnline');
      if (staffEl) staffEl.textContent = '0';
    }
  } catch (error) {
    console.error('Error loading staff:', error);
    const staffEl = document.getElementById('staffOnline');
    if (staffEl) staffEl.textContent = '-';
  }
}

// Show API not configured message
function showApiNotConfigured() {
  const statusBadge = document.getElementById('serverStatus');
  if (statusBadge) {
    statusBadge.className = 'status-badge';
    statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> API Not Configured';
  }
  
  // Show setup message in activity
  const activityFeed = document.getElementById('activityFeed');
  if (activityFeed) {
    activityFeed.innerHTML = `
      <div class="activity-item" style="border-left-color: #ffc107;">
        <div class="activity-icon" style="background: linear-gradient(135deg, #ffc107, #ff9800);">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <div class="activity-content">
          <p class="activity-text">API key not configured</p>
          <p class="activity-time">Configure your ER:LC API key to enable live features</p>
        </div>
      </div>
      <button class="primary-btn" onclick="goToSettings()" style="width: 100%; margin-top: 1rem;">
        <i class="fa-solid fa-cog"></i> Configure API
      </button>
    `;
  }
}

// Load recent activity (mock data for now)
function loadRecentActivity() {
  const activityFeed = document.getElementById('activityFeed');
  if (!activityFeed) return;
  
  const activities = [
    { icon: 'circle-check', text: 'Server dashboard loaded', time: 'Just now', color: '#4ade80' },
    { icon: 'users', text: '3 players joined', time: '5 minutes ago', color: '#60a5fa' },
    { icon: 'bullhorn', text: 'Announcement sent', time: '15 minutes ago', color: '#a020f0' },
  ];
  
  activityFeed.innerHTML = activities.map(activity => `
    <div class="activity-item">
      <div class="activity-icon" style="background: ${activity.color};">
        <i class="fa-solid fa-${activity.icon}"></i>
      </div>
      <div class="activity-content">
        <p class="activity-text">${activity.text}</p>
        <p class="activity-time">${activity.time}</p>
      </div>
    </div>
  `).join('');
}

// Set quick command
function setQuickCommand(cmd) {
  const input = document.getElementById('quickCommand');
  if (input) {
    input.value = cmd;
    input.focus();
  }
}

// Execute quick command
async function executeQuickCommand() {
  const input = document.getElementById('quickCommand');
  if (!input) return;
  
  const command = input.value.trim();
  
  if (!command) {
    alert('Please enter a command');
    return;
  }
  
  if (!serverData || !serverData.apiKey) {
    alert('⚠️ API not configured.\n\nPlease set up your API key in server settings to execute commands.');
    goToSettings();
    return;
  }
  
  try {
    console.log('Executing command:', command);
    
    const response = await fetch(`/api/erlc/command/${serverId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountID: accountID,
        command: command
      })
    });
    
    const data = await response.json();
    console.log('Command response:', data);
    
    if (data.success) {
      alert(`✅ Command executed successfully:\n${command}`);
      
      // Add to history
      addCommandToHistory(command);
      
      // Clear input
      input.value = '';
      
      // Add to activity feed
      const activityFeed = document.getElementById('activityFeed');
      if (activityFeed) {
        const newActivity = `
          <div class="activity-item">
            <div class="activity-icon" style="background: #a020f0;">
              <i class="fa-solid fa-terminal"></i>
            </div>
            <div class="activity-content">
              <p class="activity-text">Command executed: ${command}</p>
              <p class="activity-time">Just now</p>
            </div>
          </div>
        `;
        activityFeed.insertAdjacentHTML('afterbegin', newActivity);
      }
      
      // Refresh data after a moment
      setTimeout(refreshData, 2000);
    } else {
      alert('❌ Command failed: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error executing command:', error);
    alert('❌ Failed to execute command. Please try again.');
  }
}

// Add command to history
function addCommandToHistory(command) {
  commandHistory.unshift({
    command: command,
    timestamp: new Date().toLocaleTimeString()
  });
  
  // Keep only last 5
  if (commandHistory.length > 5) {
    commandHistory = commandHistory.slice(0, 5);
  }
  
  // Update UI
  const historyList = document.getElementById('historyList');
  if (historyList) {
    if (commandHistory.length === 0) {
      historyList.innerHTML = '<p style="color: #666; text-align: center;">No commands executed yet</p>';
    } else {
      historyList.innerHTML = commandHistory.map(item => `
        <div class="history-item">
          <span class="history-cmd">${item.command}</span>
          <span class="history-time">${item.timestamp}</span>
        </div>
      `).join('');
    }
  }
}

// Navigation functions
function goToFeature(feature) {
  window.location.href = `/main/features/${feature}.html?serverId=${serverId}&accountID=${accountID}`;
}

function goToSettings() {
  window.location.href = `/main/server-settings.html?id=${serverId}&accountID=${accountID}`;
}

// Refresh all data
function refreshData() {
  if (serverData && serverData.apiKey) {
    loadLiveData();
  }
  
  // Visual feedback
  const refreshIcons = document.querySelectorAll('.fa-rotate');
  refreshIcons.forEach(icon => {
    icon.style.animation = 'spin 1s linear';
    setTimeout(() => {
      icon.style.animation = '';
    }, 1000);
  });
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
  console.log('Page loaded, initializing...');
  console.log('Server ID:', serverId);
  console.log('Account ID:', accountID);
  
  loadServerData();
  revealOnScroll();
  
  // Fade in animation
  const fadeElements = document.querySelectorAll('.fade-in');
  fadeElements.forEach(el => {
    el.classList.add('active');
  });
  
  // Auto-refresh every 30 seconds
  setInterval(() => {
    if (serverData && serverData.apiKey) {
      loadLiveData();
    }
  }, 30000);
  
  // Allow Enter key to execute command
  const commandInput = document.getElementById('quickCommand');
  if (commandInput) {
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        executeQuickCommand();
      }
    });
  }
});
