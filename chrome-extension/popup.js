const statusText = document.getElementById('status-text');
let vocabData = [];

document.addEventListener('DOMContentLoaded', () => {
  // console.log('Popup initialized');

  // Translate
  document.getElementById('extension-name').textContent = chrome.i18n.getMessage('extensionName');
  document.getElementById('scan-button').textContent = chrome.i18n.getMessage('scanButton');
  document.getElementById('clear-button').textContent = chrome.i18n.getMessage('clearButton');
  document.getElementById('auto-scan-label').textContent = chrome.i18n.getMessage('autoScan');
  document.getElementById('status-text').textContent = chrome.i18n.getMessage('readyToScan');
  document.title = chrome.i18n.getMessage('extensionName');  

  // Load vocabulary data
  fetch('taiwan_china_vocabs.json')
    .then(response => response.json())
    .then(data => {
      vocabData = data;
      // statusText.textContent = `Loaded ${data.length} vocabulary words`;
      statusText.textContent = chrome.i18n.getMessage('loadedVocabulary', data.length.toString());

      // Show the current language
      const currentLanguage = chrome.i18n.getUILanguage();
      console.log('Current language:', currentLanguage);
      statusText.textContent = `Current language: ${currentLanguage}`;
    })
    .catch(error => {
      console.error('Error loading vocabs:', error);
      statusText.textContent = 'Error loading vocabs: ' + error.message;
    });

  // Helper function to ensure content script is loaded
  async function ensureContentScript(tabId) {
    return new Promise((resolve) => {
      // First, try to ping the content script
      chrome.tabs.sendMessage(tabId, {action: "ping"}, function(response) {
        if (chrome.runtime.lastError || !response) {
          // Content script not loaded, inject it
          // console.log('Content script not found, injecting...');
          chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
          }).then(() => {
            // console.log('Content script injected successfully');
            // Small delay to ensure script is ready
            setTimeout(() => resolve(true), 100);
          }).catch((error) => {
            console.error('Failed to inject content script:', error);
            resolve(false);
          });
        } else {
          // Content script is already loaded
        //   console.log('Content script already loaded');
          resolve(true);
        }
      });
    });
  }

  // Set up scan button click handler
  document.getElementById('scan-button').addEventListener('click', async () => {
    await performScan();
  });

  // Function to perform the scan
  async function performScan() {
    statusText.textContent = chrome.i18n.getMessage('scanning');

    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Ensure content script is loaded
      const scriptLoaded = await ensureContentScript(tab.id);
      
      if (!scriptLoaded) {
        statusText.textContent = 'Failed to load content script. Try refreshing the page.';
        return;
      }

      // Send vocabulary data to content script for scanning
      chrome.tabs.sendMessage(tab.id, {
        action: "scan", 
        vocabData: vocabData
      }, function(response) {
        
        if (chrome.runtime.lastError) {
          statusText.textContent = 'Error: ' + chrome.runtime.lastError.message + 
            '\n\nTry refreshing the page and scanning again.';
          return;
        }

        if (response && response.success) {
          statusText.textContent = chrome.i18n.getMessage('scanCompleted', response.highlightedCount.toString());

        } else {
          statusText.textContent = 'Scan failed or no response received';
        }
      });
      
    } catch (error) {
      console.error('Error during scan:', error);
      statusText.textContent = 'Error: ' + error.message;
    }
  }

  // Set up auto scan interval
  let autoScanInterval;
  document.getElementById('auto-scan-switch').addEventListener('change', async function(e) {
    await chrome.storage.sync.set({
      'autoScanSetting': e.target.checked
    });

    if (e.target.checked) {
      // Start auto scan every 10 seconds
      autoScanInterval = setInterval(performScan, 10000);
      // Perform initial scan immediately
      performScan();
    } else {
      // Stop auto scan
      if (autoScanInterval) {
        clearInterval(autoScanInterval);
      }
    }
  });

  // Initialize auto scan if enabled
  chrome.storage.sync.get(['autoScanSetting'], function(result) {
    if (result.autoScanSetting) {
      autoScanInterval = setInterval(performScan, 10000);
      // Perform initial scan immediately if auto scan is enabled
      performScan();
    }
  });

  // Add clear highlights button
  document.getElementById('clear-button')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Ensure content script is loaded
      const scriptLoaded = await ensureContentScript(tab.id);
      
      if (!scriptLoaded) {
        statusText.textContent = 'Failed to load content script. Try refreshing the page.';
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: "clearHighlights"}, function(response) {
        if (chrome.runtime.lastError) {
          statusText.textContent = 'Error clearing highlights: ' + chrome.runtime.lastError.message;
          return;
        }
        
        if (response && response.success) {
          statusText.textContent = chrome.i18n.getMessage('highlightsCleared');
        } else {
          statusText.textContent = chrome.i18n.getMessage('failedToClearHighlights');
        }
      });
    } catch (error) {
      statusText.textContent = 'Error: ' + error.message;
    }
  });

  document.getElementById('auto-scan-switch').addEventListener('change', async function(e) {
    await chrome.storage.sync.set({
      'autoScanSetting': e.target.checked
    });
  });
});

// Load setting
document.addEventListener('DOMContentLoaded', async () => {
  const result = await chrome.storage.sync.get(['autoScanSetting']);
  document.getElementById('auto-scan-switch').checked = result.autoScanSetting || false;
});
