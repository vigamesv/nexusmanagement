// Get URL parameters
function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const serverId = getQueryParam('id');
const accountID = getQueryParam('accountID') || localStorage.getItem('accountID');

// Update nav links
if (accountID) {
  const dashLink = document.getElementById('dashboardLink');
  const serversLink = document.getElementById('serversLink');
  if (dashLink) dashLink.href = `/dashboard/user.html?ID=${accountID}`;
  if (serversLink) serversLink.href = `/main/servers.html?ID=${accountID}`;
}

// Global variables
let serverData = null;

// Load server settings on page load
async function loadServerSettings() {
  if (!serverId || !accountID) {
    alert('Missing server or account information');
    window.location.href = `/main/servers.html?ID=${accountID}`;
    return;
  }

  try {
    // Fetch server data from backend
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    const data = await response.json();

    if (data.success) {
      serverData = data.server;
      
      // Update server name
      document.getElementById('serverName').textContent = serverData.name || 'Server Settings';
      document.title = `${serverData.name} Settings - Nexus Management`;
      
      // If API key exists, show masked value and status
      if (serverData.apiKey) {
        document.getElementById('apiKey').value = '••••••••••••••';
        
        // Show API status
        const statusEl = document.getElementById('apiStatus');
        statusEl.style.display = 'flex';
        statusEl.style.alignItems = 'center';
        statusEl.style.gap = '0.5rem';
        statusEl.style.padding = '1rem';
        statusEl.style.background = 'rgba(34, 197, 94, 0.1)';
        statusEl.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        statusEl.style.borderRadius = '8px';
        statusEl.style.color = '#4ade80';
        statusEl.style.marginTop = '1rem';

        // Load server info
        loadServerInfo();
      }
    }
  } catch (error) {
    console.error('Error loading server settings:', error);
  }
}

// Save API settings
document.getElementById('apiForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiKeyInput = document.getElementById('apiKey');
  if (!apiKeyInput) {
    alert('API key field not found');
    return;
  }

  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    alert('Please enter your API key');
    return;
  }

  // Don't update if API key is masked
  if (apiKey === '••••••••••••••') {
    alert('API key is already saved. Enter a new key to update.');
    return;
  }

  try {
    // Test connection first
    const testResult = await fetch(`/api/erlc/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey })
    });

    const testData = await testResult.json();

    if (!testData.success) {
      alert('❌ Failed to connect to ER:LC API.\n\n' + testData.error + '\n\nMake sure you\'re using your SERVER KEY from ER:LC game settings (not your PRC account password).');
      return;
    }

    // Save to backend
    const response = await fetch(`/api/servers/${serverId}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accountID,
        apiKey
      })
    });

    const data = await response.json();

    if (data.success) {
      const serverName = testData.server ? testData.server.Name : 'your server';
      alert(`✅ API settings saved successfully!\n\nConnected to: ${serverName}`);
      
      // Show status
      const statusEl = document.getElementById('apiStatus');
      statusEl.style.display = 'flex';
      
      // Reload server info
      loadServerInfo();
      
      // Mask API key
      document.getElementById('apiKey').value = '••••••••••••••';
    } else {
      alert('Failed to save settings: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Failed to save settings. Please try again.');
  }
});

// Test API connection
async function testConnection() {
  const apiKeyInput = document.getElementById('apiKey');
  if (!apiKeyInput) {
    alert('API key field not found');
    return;
  }

  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    alert('Please enter your API key first');
    return;
  }

  if (apiKey === '••••••••••••••') {
    alert('Using saved API key to test connection...');
    // Load from backend
    try {
      const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
      const data = await response.json();
      
      if (data.success && data.server.apiKey) {
        // Can't test with masked key, just confirm it exists
        alert('✅ API key is saved. To test, please refresh the page and check the server information below.');
        loadServerInfo();
      } else {
        alert('No saved API key found');
      }
    } catch (error) {
      alert('Failed to load saved credentials');
    }
    return;
  }

  // Test with provided key
  try {
    const response = await fetch(`/api/erlc/test-connection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey })
    });

    const data = await response.json();

    if (data.success) {
      const server = data.server;
      alert(`✅ Connection successful!\n\nServer: ${server.Name}\nPlayers: ${server.CurrentPlayers}/${server.MaxPlayers}\nOwner: ${server.OwnerUsername}`);
    } else {
      alert('❌ Connection failed.\n\n' + (data.error || 'Invalid Server Key') + '\n\nMake sure you\'re using your SERVER KEY from ER:LC game settings.');
    }
  } catch (error) {
    console.error('Test connection error:', error);
    alert('❌ Failed to test connection. Please try again.');
  }
}

// Load server information from ER:LC API
async function loadServerInfo() {
  try {
    const response = await fetch(`/api/erlc/server-info/${serverId}?accountID=${accountID}`);
    const data = await response.json();

    if (data.success && data.serverInfo) {
      const info = data.serverInfo;
      
      // Show and update server info card
      const infoCard = document.getElementById('serverInfoCard');
      if (infoCard) infoCard.style.display = 'block';
      
      // Update fields
      document.getElementById('infoServerName').textContent = info.Name || '-';
      document.getElementById('infoPlayers').textContent = `${info.CurrentPlayers || 0}/${info.MaxPlayers || 0}`;
      document.getElementById('infoOwner').textContent = info.OwnerUsername || '-';
      document.getElementById('infoMap').textContent = info.MapName || '-';
    }
  } catch (error) {
    console.error('Error loading server info:', error);
  }
}

// Navigation functions
function goToFeature(feature) {
  window.location.href = `/main/features/${feature}.html?serverId=${serverId}&accountID=${accountID}`;
}

function goToServerDashboard() {
  window.location.href = `/main/server.html?id=${serverId}&accountID=${accountID}`;
}

// Delete server functions
function confirmDeleteServer() {
  if (!serverData) {
    alert('Server data not loaded');
    return;
  }
  
  document.getElementById('deleteServerName').textContent = serverData.name;
  document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
}

async function deleteServer() {
  if (!serverData || !serverId || !accountID) {
    alert('Missing server information');
    return;
  }

  try {
    const response = await fetch(`/api/servers/${serverId}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountID })
    });

    const data = await response.json();

    if (data.success) {
      alert('✅ Server deleted successfully!');
      closeDeleteModal();
      
      // Redirect to servers page
      setTimeout(() => {
        window.location.href = `/main/servers.html?ID=${accountID}`;
      }, 1000);
    } else {
      alert('❌ Failed to delete server: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error deleting server:', error);
    alert('❌ Failed to delete server. Please try again.');
  }
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('deleteModal');
  if (event.target === modal) {
    closeDeleteModal();
  }
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
  loadServerSettings();
  revealOnScroll();
  
  // Fade in animation
  const fadeElements = document.querySelectorAll('.fade-in');
  fadeElements.forEach(el => {
    el.classList.add('active');
  });
});