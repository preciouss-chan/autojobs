// options/options.js

// Load saved settings
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'openaiApiKey',
      'showNotifications',
      'confirmBeforeUpload'
    ], (result) => {
      resolve(result);
    });
  });
}

// Save settings
async function saveSettings() {
  const settings = {
    openaiApiKey: document.getElementById('openaiKey').value.trim(),
    showNotifications: document.getElementById('showNotifications').checked,
    confirmBeforeUpload: document.getElementById('confirmBeforeUpload').checked
  };

  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved successfully!', 'success');
  });
}

// Show status message
function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// Load settings on page load
(async () => {
  const settings = await loadSettings();
  
  if (settings.openaiApiKey) {
    document.getElementById('openaiKey').value = settings.openaiApiKey;
  }
  document.getElementById('showNotifications').checked = settings.showNotifications !== false; // default true
  document.getElementById('confirmBeforeUpload').checked = settings.confirmBeforeUpload || false;
})();

// Save button
document.getElementById('saveSettings').addEventListener('click', saveSettings);

// Reset to defaults
document.getElementById('resetSettings').addEventListener('click', () => {
  if (confirm('Reset all settings to defaults? This will clear your API key.')) {
    chrome.storage.sync.clear(() => {
      document.getElementById('openaiKey').value = '';
      document.getElementById('showNotifications').checked = true;
      document.getElementById('confirmBeforeUpload').checked = false;
      showStatus('Settings reset to defaults', 'success');
    });
  }
});

// Export settings
document.getElementById('exportSettings').addEventListener('click', async () => {
  const settings = await loadSettings();
  const dataStr = JSON.stringify(settings, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'autojobs-settings.json';
  a.click();
  URL.revokeObjectURL(url);
  showStatus('Settings exported!', 'success');
});

// Import settings
document.getElementById('importSettings').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        chrome.storage.sync.set(settings, () => {
          // Reload the page to show imported settings
          location.reload();
        });
      } catch (err) {
        showStatus('Invalid settings file', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

// Clear cache
document.getElementById('clearCache').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all cached data? This will delete:\n- Cached resumes\n- Cover letters\n- Uploaded resume data\n\nThis cannot be undone!')) {
    chrome.storage.local.clear(() => {
      showStatus('All cached data cleared!', 'success');
    });
  }
});

