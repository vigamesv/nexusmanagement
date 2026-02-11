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

// Global variables
let announcements = [];
let runningTimers = {};

// Load announcements from localStorage (server-specific)
function loadAnnouncements() {
  const storageKey = `announcements_${serverId}`;
  const stored = localStorage.getItem(storageKey);
  
  if (stored) {
    announcements = JSON.parse(stored);
  } else {
    announcements = [];
  }
  
  renderAnnouncements();
  updateStats();
  
  // Restart active timers
  announcements.forEach(ann => {
    if (ann.enabled) {
      startAnnouncement(ann.id);
    }
  });
}

// Save announcements to localStorage
function saveAnnouncements() {
  const storageKey = `announcements_${serverId}`;
  localStorage.setItem(storageKey, JSON.stringify(announcements));
  updateStats();
}

// Create announcement
document.getElementById('announcementForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const commandType = document.getElementById('commandType').value;
  const message = document.getElementById('message').value.trim();
  const interval = parseInt(document.getElementById('interval').value);
  const enabled = document.getElementById('enabled').checked;
  
  if (!message) {
    showError('Empty Message', 'Please enter a message');
    return;
  }
  
  const announcement = {
    id: Date.now(),
    command: `${commandType} ${message}`,
    message: message,
    interval: interval,
    intervalLabel: getIntervalLabel(interval),
    enabled: enabled,
    lastRun: null,
    runCount: 0
  };
  
  announcements.push(announcement);
  saveAnnouncements();
  renderAnnouncements();
  
  // Start if enabled
  if (enabled) {
    startAnnouncement(announcement.id);
  }
  
  // Clear form
  document.getElementById('message').value = '';
  document.getElementById('charCount').textContent = '0';
  
  showSuccess('Announcement Created', `Will run ${announcement.intervalLabel.toLowerCase()}`);
});

// Get interval label
function getIntervalLabel(ms) {
  const minutes = ms / 60000;
  if (minutes < 60) return `Every ${minutes} minutes`;
  const hours = minutes / 60;
  return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
}

// Start announcement timer
function startAnnouncement(id) {
  const announcement = announcements.find(a => a.id === id);
  if (!announcement || !announcement.enabled) return;
  
  // Clear existing timer
  if (runningTimers[id]) {
    clearInterval(runningTimers[id]);
  }
  
  // Execute immediately
  executeAnnouncement(id);
  
  // Set up interval
  runningTimers[id] = setInterval(() => {
    executeAnnouncement(id);
  }, announcement.interval);
  
  console.log(`Started announcement timer for: ${announcement.command}`);
}

// Stop announcement timer
function stopAnnouncement(id) {
  if (runningTimers[id]) {
    clearInterval(runningTimers[id]);
    delete runningTimers[id];
    console.log(`Stopped announcement timer: ${id}`);
  }
}

// Execute announcement command
async function executeAnnouncement(id) {
  const announcement = announcements.find(a => a.id === id);
  if (!announcement) return;
  
  try {
    const response = await fetch(`/api/erlc/command/${serverId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountID: accountID,
        command: announcement.command
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update last run time and count
      const ann = announcements.find(a => a.id === id);
      if (ann) {
        ann.lastRun = new Date().toISOString();
        ann.runCount++;
        saveAnnouncements();
        renderAnnouncements();
      }
      console.log(`✅ Announcement executed: ${announcement.command}`);
    } else {
      console.error(`❌ Failed to execute announcement: ${data.error}`);
    }
  } catch (error) {
    console.error('Error executing announcement:', error);
  }
}

// Toggle announcement
function toggleAnnouncement(id) {
  const announcement = announcements.find(a => a.id === id);
  if (!announcement) return;
  
  announcement.enabled = !announcement.enabled;
  
  if (announcement.enabled) {
    startAnnouncement(id);
  } else {
    stopAnnouncement(id);
  }
  
  saveAnnouncements();
  renderAnnouncements();
}
// Delete announcement
function deleteAnnouncement(id) {
  stopAnnouncement(id);
  announcements = announcements.filter(a => a.id !== id);
  saveAnnouncements();
  renderAnnouncements();
  showSuccess('Deleted', 'Announcement removed');
}


// Test announcement (run once now)
async function testAnnouncement(id) {
  const announcement = announcements.find(a => a.id === id);
  if (!announcement) return;
  
  const confirmed = await confirmAction(
    'Test Announcement',
    `Send this message to your server now?\n\n"${announcement.command}"`
  );
  
  if (!confirmed) return;
  
  const loadingToast = showLoading('Sending announcement...');
  await executeAnnouncement(id);
  loadingToast.remove();
  showSuccess('Sent!', 'Test announcement delivered');
}

// Render announcements
function renderAnnouncements() {
  const list = document.getElementById('announcementsList');
  
  if (!list) return;
  
  if (announcements.length === 0) {
    list.innerHTML = '<p style="text-align: center; color: #666;">No announcements created yet</p>';
    return;
  }
  
  list.innerHTML = announcements.map(ann => `
    <div class="announcement-item ${ann.enabled ? 'active' : 'paused'}">
      <div class="announcement-header">
        <div class="announcement-info">
          <h4><i class="fa-solid fa-${ann.enabled ? 'circle-check' : 'circle-pause'}"></i> ${ann.command}</h4>
          <p style="color: #999; font-size: 0.9rem; margin: 0.3rem 0 0 0;">
            ${ann.intervalLabel} • ${ann.runCount} times sent
            ${ann.lastRun ? `• Last: ${new Date(ann.lastRun).toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div class="announcement-status">
          <span class="status-badge ${ann.enabled ? 'status-active' : 'status-paused'}">
            ${ann.enabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </div>
      <div class="announcement-actions">
        <button class="action-btn ${ann.enabled ? 'pause' : 'play'}" onclick="toggleAnnouncement(${ann.id})" title="${ann.enabled ? 'Pause' : 'Resume'}">
          <i class="fa-solid fa-${ann.enabled ? 'pause' : 'play'}"></i>
        </button>
        <button class="action-btn test" onclick="testAnnouncement(${ann.id})" title="Test Now">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
        <button class="action-btn delete" onclick="deleteAnnouncement(${ann.id})" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// Update statistics
function updateStats() {
  const total = announcements.length;
  const active = announcements.filter(a => a.enabled).length;
  const paused = total - active;
  
  const totalEl = document.getElementById('totalAnnouncements');
  const activeEl = document.getElementById('activeAnnouncements');
  const pausedEl = document.getElementById('pausedAnnouncements');
  
  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (pausedEl) pausedEl.textContent = paused;
}

// Update character count
document.getElementById('message').addEventListener('input', (e) => {
  const count = e.target.value.length;
  document.getElementById('charCount').textContent = count;
  
  // Update preview
  const commandType = document.getElementById('commandType').value;
  const message = e.target.value;
  const preview = document.getElementById('previewBox');
  
  if (message) {
    const color = commandType === ':h' ? '#fbbf24' : '#60a5fa';
    preview.innerHTML = `
      <div style="padding: 1rem; background: rgba(0,0,0,0.3); border-left: 3px solid ${color}; border-radius: 4px;">
        <strong style="color: ${color};">${commandType === ':h' ? 'Hint' : 'Message'}:</strong>
        <p style="margin: 0.5rem 0 0 0; color: #fff;">${message}</p>
      </div>
    `;
  } else {
    preview.innerHTML = '<p style="color: #666; text-align: center;">Type a message to see preview</p>';
  }
});

// Update preview when command type changes
document.getElementById('commandType').addEventListener('change', () => {
  document.getElementById('message').dispatchEvent(new Event('input'));
});

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

// Initialize
window.addEventListener('load', () => {
  if (!serverId || !accountID) {
    showError('Missing Information', 'Server or account information not found');
    setTimeout(() => {
      window.location.href = '/main/servers.html';
    }, 2000);
    return;
  }
  
  loadServerName();
  loadAnnouncements();
  
  // Reveal animations
  const reveals = document.querySelectorAll('.reveal');
  setTimeout(() => {
    reveals.forEach((el, index) => {
      setTimeout(() => {
        el.classList.add('active');
      }, index * 100);
    });
  }, 100);
});

// Clean up timers on page unload
window.addEventListener('beforeunload', () => {
  Object.values(runningTimers).forEach(timer => clearInterval(timer));
});
