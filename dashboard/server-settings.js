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
}

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
            // Update server name
            document.getElementById('serverName').textContent = data.server.name || 'Server Settings';
            document.querySelector('.servers-hero h1').innerHTML = `<i class="fa-solid fa-cog"></i> ${data.server.name} Settings`;

            // If API key exists, populate fields and show status
            if (data.server.apiKey) {
                document.getElementById('apiKey').value = '••••••••••••••'; // Masked for security
                document.getElementById('serverId').value = data.server.erlcServerId || '';

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

    const apiKey = document.getElementById('apiKey').value.trim();
    const erlcServerId = document.getElementById('serverId').value.trim();

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
            body: JSON.stringify({ apiKey, serverId: erlcServerId })
        });

        const testData = await testResult.json();

        if (!testData.success) {
            alert('Failed to connect to ER:LC API. Please check your API key.');
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
                apiKey,
                erlcServerId
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('API settings saved and connected successfully!');

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
    const apiKey = document.getElementById('apiKey').value.trim();
    const erlcServerId = document.getElementById('serverId').value.trim();

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
                testWithKeys(data.server.apiKey, data.server.erlcServerId);
            } else {
                alert('No saved API key found');
            }
        } catch (error) {
            alert('Failed to load saved credentials');
        }
        return;
    }

    testWithKeys(apiKey, erlcServerId);
}

async function testWithKeys(apiKey, erlcServerId) {
    try {
        const response = await fetch(`/api/erlc/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apiKey, serverId: erlcServerId })
        });

        const data = await response.json();

        if (data.success) {
            const servers = data.servers || [];
            if (servers.length === 0) {
                alert('✅ API key is valid, but no servers found. Make sure you have an ER:LC server.');
            } else {
                const serverList = servers.map(s => `• ${s.Name} (${s.CurrentPlayers}/${s.MaxPlayers} players)`).join('\n');
                alert(`✅ Connection successful!\n\nServers found:\n${serverList}`);
                loadServerInfo();
            }
        } else {
            alert('❌ Connection failed: ' + (data.error || 'Invalid API key'));
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

            // Show server info card
            document.getElementById('serverInfoCard').style.display = 'block';

            // Update fields
            document.getElementById('infoServerName').textContent = info.Name || '-';
            document.getElementById('infoPlayers').textContent = `${info.CurrentPlayers || 0}/${info.MaxPlayers || 0}`;
            document.getElementById('infoOwner').textContent = info.OwnerUsername || '-';
            document.getElementById('infoMap').textContent = info.MapName || '-';

            // Format expiration time
            if (info.JoinCodeExpiration) {
                const expireDate = new Date(info.JoinCodeExpiration);
                document.getElementById('infoExpires').textContent = expireDate.toLocaleString();
            } else {
                document.getElementById('infoExpires').textContent = '-';
            }
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