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
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation' };
  toast.innerHTML = `<div style="background:rgba(26,26,26,0.95);border:1px solid rgba(160,32,240,0.3);border-radius:12px;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;min-width:300px;box-shadow:0 10px 40px rgba(0,0,0,0.5);pointer-events:auto"><div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:${type==='success'?'rgba(34,197,94,0.2)':type==='error'?'rgba(239,68,68,0.2)':'rgba(234,179,8,0.2)'};color:${type==='success'?'#4ade80':type==='error'?'#f87171':'#fbbf24'}"><i class="fa-solid ${icons[type]}"></i></div><div style="flex:1"><div style="color:#fff;font-weight:600">${title}</div>${message?`<div style="color:#999;font-size:0.9rem">${message}</div>`:''}</div><button onclick="this.closest('.toast').remove()" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.05);border:none;color:#999;cursor:pointer"><i class="fa-solid fa-xmark"></i></button></div>`;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
  return toast;
}

function showSuccess(t, m) { return showToast('success', t, m); }
function showError(t, m) { return showToast('error', t, m); }
function showWarning(t, m) { return showToast('warning', t, m); }

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

let staffMembers = [];

async function loadServerName() {
  try {
    const response = await fetch(`/api/servers/${serverId}/settings?accountID=${accountID}`);
    const data = await response.json();
    if (data.success) document.getElementById('serverName').textContent = data.server.name;
  } catch (error) {
    console.error('Error:', error);
  }
}

function loadStaff() {
  const stored = localStorage.getItem(`staff_permissions_${serverId}`);
  if (stored) {
    staffMembers = JSON.parse(stored);
  } else {
    staffMembers = [];
  }
  renderStaff();
}

function saveStaff() {
  localStorage.setItem(`staff_permissions_${serverId}`, JSON.stringify(staffMembers));
  renderStaff();
}

function getRoleBadgeClass(role) {
  if (role === 'Owner') return 'role-owner';
  if (role === 'Administrator') return 'role-admin';
  if (role === 'Moderator') return 'role-mod';
  return 'role-staff';
}

function renderStaff() {
  const container = document.getElementById('staffTableContainer');
  
  if (staffMembers.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-users" style="font-size:3rem;color:#666"></i><p>No staff members added yet</p></div>';
    return;
  }

  container.innerHTML = `
    <table class="permissions-table">
      <thead>
        <tr>
          <th>Staff Member</th>
          <th>Role</th>
          <th style="text-align:center">Manage Server</th>
          <th style="text-align:center">Execute Commands</th>
          <th style="text-align:center">View Logs</th>
          <th style="text-align:center">Manage Staff</th>
          <th style="text-align:center">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${staffMembers.map(staff => `
          <tr>
            <td><strong>${staff.username}</strong></td>
            <td><span class="role-badge ${getRoleBadgeClass(staff.role)}">${staff.role}</span></td>
            <td class="checkbox-wrapper">
              <input type="checkbox" ${staff.permissions.manageServer ? 'checked' : ''} onchange="togglePermission(${staff.id}, 'manageServer', this.checked)">
            </td>
            <td class="checkbox-wrapper">
              <input type="checkbox" ${staff.permissions.executeCommands ? 'checked' : ''} onchange="togglePermission(${staff.id}, 'executeCommands', this.checked)">
            </td>
            <td class="checkbox-wrapper">
              <input type="checkbox" ${staff.permissions.viewLogs ? 'checked' : ''} onchange="togglePermission(${staff.id}, 'viewLogs', this.checked)">
            </td>
            <td class="checkbox-wrapper">
              <input type="checkbox" ${staff.permissions.manageStaff ? 'checked' : ''} onchange="togglePermission(${staff.id}, 'manageStaff', this.checked)">
            </td>
            <td style="text-align:center">
              <button class="action-btn" onclick="removeStaff(${staff.id})">
                <i class="fa-solid fa-trash"></i> Remove
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

document.getElementById('addStaffForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const username = document.getElementById('staffUsername').value.trim();
  const role = document.getElementById('staffRole').value;
  
  if (!username) {
    showWarning('Empty Username', 'Please enter a username');
    return;
  }

  // Check if already exists
  if (staffMembers.find(s => s.username.toLowerCase() === username.toLowerCase())) {
    showWarning('Already Added', 'This staff member already exists');
    return;
  }

  const newStaff = {
    id: Date.now(),
    username: username,
    role: role,
    permissions: {
      manageServer: role === 'Owner' || role === 'Administrator',
      executeCommands: role !== 'Staff',
      viewLogs: true,
      manageStaff: role === 'Owner' || role === 'Administrator'
    },
    addedAt: new Date().toISOString()
  };

  staffMembers.push(newStaff);
  saveStaff();

  document.getElementById('staffUsername').value = '';
  document.getElementById('staffRole').value = 'Staff';

  showSuccess('Staff Added', `${username} added as ${role}`);
});

function togglePermission(id, permission, value) {
  const staff = staffMembers.find(s => s.id === id);
  if (staff) {
    staff.permissions[permission] = value;
    saveStaff();
    showSuccess('Permission Updated', 'Changes saved successfully');
  }
}

function removeStaff(id) {
  const staff = staffMembers.find(s => s.id === id);
  if (!staff) return;

  if (confirm(`Remove ${staff.username} from staff?`)) {
    staffMembers = staffMembers.filter(s => s.id !== id);
    saveStaff();
    showSuccess('Staff Removed', `${staff.username} has been removed`);
  }
}

window.addEventListener('load', () => {
  if (!serverId || !accountID) {
    setTimeout(() => window.location.href = '/main/servers.html', 2000);
    return;
  }

  loadServerName();
  loadStaff();
});
