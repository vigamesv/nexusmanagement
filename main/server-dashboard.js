// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const serverId = getQueryParam('id');
const accountID = getQueryParam('accountID') || localStorage.getItem('accountID');

// Update nav links
if (accountID) {
  document.getElementById('dashboardLink').href = `/dashboard/user.html?ID=${accountID}`;
  document.getElementById('serversLink').href = `/main/servers.html?ID=${accountID}`;
  document.getElementById('settingsLink').href = `/main/server-settings.html?id=${serverId}&accountID=${accountID}`;
}

// Global variables
let serverData = null;
let currentCommand = null;

// Load server data on page load
async function loadServerData() {
  if (!serverId || !accountID) {
    alert('Missing server or account information');
    window.location.href = `/main/servers.html?ID=${accountID}`;
    return;
  }

  try {
    // Fetch server info from database
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    const data = await response.json();

    if (data.success) {
      serverData = data.server;
      
      // Update page title and header
      document.getElementById('serverName').textContent = serverData.name || 'Server Dashboard';
      document.title = `${serverData.name} - Nexus Management`;
      
      // Update server info
      document.getElementById('infoServerId').textContent = serverData.id;
      document.getElementById('infoPlan').textContent = serverData.plan || 'Free';
      
      // Check if API is configured
      if (serverData.apiKey) {
        document.getElementById('infoApiStatus').innerHTML = '<span class="status-dot online"></span> Connected';
        loadLiveData();
      } else {
        document.getElementById('infoApiStatus').innerHTML = '<span class="status-dot offline"></span> Not Configured';
        showApiNotConfigured();
      }
    } else {
      throw new Error(data.error || 'Failed to load server');
    }
  } catch (error) {
    console.error('Error loading server:', error);
    alert('Failed to load server data. Please try again later.');
  }
}

// Load live data from ER:LC API
async function loadLiveData() {
  try {
    const response = await fetch(`/api/erlc/server-info/${serverId}?accountID=${accountID}`);
    const data = await response.json();

    if (data.success && data.serverInfo) {
      const info = data.serverInfo;
      
      // Update status
      const statusBadge = document.getElementById('serverStatus');
      statusBadge.className = 'status-badge online';
      statusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Server Online';
      
      // Update stats
      document.getElementById('playersOnline').textContent = `${info.CurrentPlayers || 0}/${info.MaxPlayers || 0}`;
      document.getElementById('currentMap').textContent = info.MapName || 'Unknown';
      document.getElementById('infoOwner').textContent = info.OwnerUsername || 'Unknown';
      
      // Calculate uptime (mock for now)
      document.getElementById('uptime').textContent = '2h 34m';
      
      // Fetch staff count
      loadStaffCount();
      
      // Load activity
      loadRecentActivity();
    } else {
      // Server offline or API error
      const statusBadge = document.getElementById('serverStatus');
      statusBadge.className = 'status-badge offline';
      statusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> Server Offline';
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
      document.getElementById('staffOnline').textContent = `${onlineStaff}/${data.staff.length}`;
    } else {
      document.getElementById('staffOnline').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading staff:', error);
    document.getElementById('staffOnline').textContent = '-';
  }
}

// Show API not configured message
function showApiNotConfigured() {
  const statusBadge = document.getElementById('serverStatus');
  statusBadge.className = 'status-badge';
  statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> API Not Configured';
  
  // Show setup message in activity
  const activityFeed = document.getElementById('activityFeed');
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

// Load recent activity (mock data for now)
function loadRecentActivity() {
  const activityFeed = document.getElementById('activityFeed');
  
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

// Navigate to feature
function goToFeature(feature) {
  window.location.href = `/main/features/${feature}.html?serverId=${serverId}&accountID=${accountID}`;
}

// Navigate to settings
function goToSettings() {
  window.location.href = `/main/server-settings.html?id=${serverId}&accountID=${accountID}`;
}

// Execute command
function executeCommand(command) {
  currentCommand = command;
  
  if (command === ':announcement ') {
    document.getElementById('commandInput').value = command;
    document.getElementById('commandInput').focus();
    document.getElementById('commandModal').style.display = 'flex';
  } else {
    // For other commands, confirm first
    if (confirm(`Are you sure you want to execute: ${command}?`)) {
      submitCommandDirect(command);
    }
  }
}

// Open command modal
function openCommandModal() {
  document.getElementById('commandModal').style.display = 'flex';
  document.getElementById('commandInput').focus();
}

// Close command modal
function closeCommandModal() {
  document.getElementById('commandModal').style.display = 'none';
  document.getElementById('commandInput').value = '';
}

// Submit command
async function submitCommand() {
  const command = document.getElementById('commandInput').value.trim();
  
  if (!command) {
    alert('Please enter a command');
    return;
  }
  
  await submitCommandDirect(command);
  closeCommandModal();
}

// Submit command directly
async function submitCommandDirect(command) {
  if (!serverData || !serverData.apiKey) {
    alert('API not configured. Please set up your API key in server settings.');
    goToSettings();
    return;
  }
  
  try {
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
    
    if (data.success) {
      alert(`✅ Command executed successfully: ${command}`);
      
      // Add to activity feed
      const activityFeed = document.getElementById('activityFeed');
      const newActivity = `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="fa-solid fa-terminal"></i>
          </div>
          <div class="activity-content">
            <p class="activity-text">Command executed: ${command}</p>
            <p class="activity-time">Just now</p>
          </div>
        </div>
      `;
      activityFeed.insertAdjacentHTML('afterbegin', newActivity);
      
      // Refresh data
      setTimeout(refreshData, 2000);
    } else {
      alert('❌ Command failed: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error executing command:', error);
    alert('❌ Failed to execute command. Please try again.');
  }
}

// Refresh all data
function refreshData() {
  loadLiveData();
  
  // Visual feedback
  const refreshBtn = event?.target || document.querySelector('.action-card:nth-child(3)');
  if (refreshBtn) {
    const icon = refreshBtn.querySelector('i');
    if (icon) {
      icon.style.animation = 'spin 1s linear';
      setTimeout(() => {
        icon.style.animation = '';
      }, 1000);
    }
  }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('commandModal');
  if (event.target === modal) {
    closeCommandModal();
  }
}

// Spin animation for refresh
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

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
});
