const statusText = document.getElementById('status-text');
const navigationContainer = document.getElementById('navigation-container');
const navigationInfo = document.getElementById('navigation-info');
const prevHighlightBtn = document.getElementById('prev-highlight-btn');
const nextHighlightBtn = document.getElementById('next-highlight-btn');

let vocabData = [];
let currentHighlightCount = 0;

document.addEventListener('DOMContentLoaded', () => {

  // Translate
  document.getElementById('extension-name').textContent = chrome.i18n.getMessage('extensionName');
  document.getElementById('scan-button').textContent = chrome.i18n.getMessage('scanButton');
  document.getElementById('clear-button').textContent = chrome.i18n.getMessage('clearButton');
  document.getElementById('auto-scan-label').textContent = chrome.i18n.getMessage('autoScan');
  document.getElementById('status-text').textContent = chrome.i18n.getMessage('readyToScan');
  document.title = chrome.i18n.getMessage('extensionName');  
  document.getElementById('prev-highlight-btn').textContent = chrome.i18n.getMessage('prevHighlightBtn');
  document.getElementById('next-highlight-btn').textContent = chrome.i18n.getMessage('nextHighlightBtn');
  document.getElementById('navigate').textContent = chrome.i18n.getMessage('navigate');

  // Load vocabulary data
  fetch('taiwan_china_vocabs.json')
    .then(response => response.json())
    .then(data => {
      vocabData = data;
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
          // console.log('Content script not found, injecting...');
          chrome.scripting.executeScript({
            target: {tabId: tabId},
            files: ['content.js']
          }).then(() => {
            // Small delay to ensure script is ready
            setTimeout(() => resolve(true), 100);
          }).catch((error) => {
            console.error('Failed to inject content script:', error);
            resolve(false);
          });
        } else {
          // Content script is already loaded
          resolve(true);
        }
      });
    });
  }

  // Function to update navigation UI
  function updateNavigationUI(highlightCount) {
    currentHighlightCount = highlightCount;
    
    if (highlightCount > 1) {
      // Multiple highlights: enable both buttons for cycling
      navigationInfo.textContent = `0 / ${highlightCount}`;
      prevHighlightBtn.disabled = false;
      nextHighlightBtn.disabled = false;
    } else if (highlightCount === 1) {
      // Single highlight: disable both buttons (no cycling needed)
      navigationInfo.textContent = `0 / ${highlightCount}`;
      prevHighlightBtn.disabled = true;
      nextHighlightBtn.disabled = true;
    } else {
      // No highlights: disable both buttons
      nextHighlightBtn.disabled = true;
      prevHighlightBtn.disabled = true;
    }
  }

  // Function to update navigation info
  function updateNavigationInfo(currentIndex, totalCount, hasNext, hasPrevious) {
    navigationInfo.textContent = `${currentIndex + 1} / ${totalCount}`;
    nextHighlightBtn.disabled = !hasNext;
    prevHighlightBtn.disabled = !hasPrevious;
  }

  // Set up scan button click handler
  document.getElementById('scan-button').addEventListener('click', async () => {
    await performScan();
  });

  // Function to perform the scan
  async function performScan(isAutoScan = false) {
    // Don't show "scanning" message for auto-scans to avoid UI flicker
    if (!isAutoScan) {
      statusText.textContent = chrome.i18n.getMessage('scanning');
    }

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
        vocabData: vocabData,
        isAutoScan: isAutoScan
      }, function(response) {
        
        if (chrome.runtime.lastError) {
          // Only show error for manual scans
          if (!isAutoScan) {
            statusText.textContent = 'Error: ' + chrome.runtime.lastError.message + 
              '\n\nTry refreshing the page and scanning again.';
          }
          return;
        }

        if (response && response.success) {
          // Handle skipped auto-scans
          if (response.skipped) {
            console.log("Auto-scan was skipped due to navigation activity");
            return;
          }
          
          // Only update UI for manual scans or if highlight count changed
          if (!isAutoScan || response.highlightedCount !== currentHighlightCount) {
            statusText.textContent = chrome.i18n.getMessage('scanCompleted', response.highlightedCount.toString());
            updateNavigationUI(response.highlightedCount);
          }
        } else {
          if (!isAutoScan) {
            statusText.textContent = 'Scan failed or no response received';
            updateNavigationUI(0);
          }
        }
      });
      
    } catch (error) {
      console.error('Error during scan:', error);
      if (!isAutoScan) {
        statusText.textContent = 'Error: ' + error.message;
        updateNavigationUI(0);
      }
    }
  }

  // Navigation button handlers
  nextHighlightBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      const scriptLoaded = await ensureContentScript(tab.id);
      if (!scriptLoaded) {
        statusText.textContent = 'Failed to load content script. Try refreshing the page.';
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: "jumpToNext"}, function(response) {
        if (chrome.runtime.lastError) {
          statusText.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        
        if (response && response.success) {
          updateNavigationInfo(response.currentIndex, response.totalCount, response.hasNext, response.hasPrevious);
          statusText.textContent = response.message;
        } else {
          statusText.textContent = 'Failed to navigate to next highlight';
        }
      });
    } catch (error) {
      statusText.textContent = 'Error: ' + error.message;
    }
  });

  prevHighlightBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      const scriptLoaded = await ensureContentScript(tab.id);
      if (!scriptLoaded) {
        statusText.textContent = 'Failed to load content script. Try refreshing the page.';
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, {action: "jumpToPrevious"}, function(response) {
        if (chrome.runtime.lastError) {
          statusText.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        
        if (response && response.success) {
          updateNavigationInfo(response.currentIndex, response.totalCount, response.hasNext, response.hasPrevious);
          statusText.textContent = response.message;
        } else {
          statusText.textContent = 'Failed to navigate to previous highlight';
        }
      });
    } catch (error) {
      statusText.textContent = 'Error: ' + error.message;
    }
  });

  // Set up auto scan interval
  let autoScanInterval;
  document.getElementById('auto-scan-switch').addEventListener('change', async function(e) {
    await chrome.storage.sync.set({
      'autoScanSetting': e.target.checked
    });

    if (e.target.checked) {
      // Start auto scan every 10 seconds
      autoScanInterval = setInterval(() => performScan(true), 10000);
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
      autoScanInterval = setInterval(() => performScan(true), 10000);
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
          updateNavigationUI(0);
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