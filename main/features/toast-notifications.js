// Toast Notification System
// Add this to your pages for non-intrusive notifications

// Create toast container if it doesn't exist
function initToastContainer() {
  if (!document.querySelector('.toast-container')) {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

// Show toast notification
function showToast(type, title, message, duration = 4000) {
  initToastContainer();
  
  const container = document.querySelector('.toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">
      <i class="fa-solid ${icons[type]}"></i>
    </div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  
  return toast;
}

// Convenience functions
function showSuccess(title, message, duration) {
  return showToast('success', title, message, duration);
}

function showError(title, message, duration) {
  return showToast('error', title, message, duration);
}

function showWarning(title, message, duration) {
  return showToast('warning', title, message, duration);
}

function showInfo(title, message, duration) {
  return showToast('info', title, message, duration);
}

// Show loading toast (doesn't auto-dismiss)
function showLoading(message) {
  return showToast('info', message, '<div class="spinner"></div>', 0);
}

// Show in-page status message
function showStatusMessage(type, message, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };
  
  const statusDiv = document.createElement('div');
  statusDiv.className = `status-message ${type}`;
  statusDiv.innerHTML = `
    <i class="fa-solid ${icons[type]}"></i>
    <span>${message}</span>
  `;
  
  container.innerHTML = '';
  container.appendChild(statusDiv);
  
  return statusDiv;
}

// Confirm dialog (returns Promise)
function confirmAction(title, message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2><i class="fa-solid fa-triangle-exclamation"></i> ${title}</h2>
        </div>
        <div class="modal-body">
          <p style="color: #fff; margin: 0;">${message}</p>
        </div>
        <div class="modal-footer" style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button class="secondary-btn confirm-cancel">Cancel</button>
          <button class="primary-btn confirm-yes">Confirm</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.confirm-cancel').onclick = () => {
      modal.remove();
      resolve(false);
    };
    
    modal.querySelector('.confirm-yes').onclick = () => {
      modal.remove();
      resolve(true);
    };
    
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        resolve(false);
      }
    };
  });
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToastContainer);
} else {
  initToastContainer();
}
