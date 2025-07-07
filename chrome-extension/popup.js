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
  document.getElementById('update-button').title = chrome.i18n.getMessage('updateButton');
  document.getElementById('auto-scan-label').textContent = chrome.i18n.getMessage('autoScan');
  document.getElementById('status-text').textContent = chrome.i18n.getMessage('readyToScan');
  document.title = chrome.i18n.getMessage('extensionName');  
  document.getElementById('prev-highlight-btn').textContent = chrome.i18n.getMessage('prevHighlightBtn');
  document.getElementById('next-highlight-btn').textContent = chrome.i18n.getMessage('nextHighlightBtn');
  document.getElementById('navigate').textContent = chrome.i18n.getMessage('navigate');
  
  // Translate vocabulary submission form elements
  document.getElementById('submission-title').textContent = chrome.i18n.getMessage('submitVocabulary') || 'Submit New Vocabulary';
  
  // Set translations with red asterisks for required fields
  const chineseLabel = document.getElementById('chinese-label');
  chineseLabel.innerHTML = (chrome.i18n.getMessage('chineseLabel') || 'Chinese (中國):') + ' <span style="color: red;">*</span>';
  
  const taiwaneseLabel = document.getElementById('taiwanese-label');
  taiwaneseLabel.innerHTML = (chrome.i18n.getMessage('taiwaneseLabel') || 'Taiwanese (台灣):') + ' <span style="color: red;">*</span>';
  
  document.getElementById('english-label').textContent = chrome.i18n.getMessage('englishLabel') || 'English:';
  document.getElementById('description-label').textContent = chrome.i18n.getMessage('descriptionLabel') || 'Description:';
  document.getElementById('submit-vocab-btn').textContent = chrome.i18n.getMessage('submitBtn') || 'Submit';
  document.getElementById('clear-form-btn').textContent = chrome.i18n.getMessage('clearFormBtn') || 'Clear';

  // Function to update vocabulary data from API
  async function updateVocabularyData(forceUpdate = false) {
    try {
      console.log('Fetching updated vocabulary data...');
      statusText.textContent = 'Checking for vocabulary updates...';
      
      const response = await fetch('https://radar.aronhack.com/get-taiwan-china-vocabs');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const newData = await response.json();
      
      // Validate the data structure
      if (!Array.isArray(newData) || newData.length === 0) {
        throw new Error('Invalid vocabulary data received');
      }
      
      // Store the new data and timestamp
      await chrome.storage.local.set({
        'vocabData': newData,
        'vocabUpdateTime': Date.now()
      });
      
      vocabData = newData;
      statusText.textContent = chrome.i18n.getMessage('loadedVocabulary', vocabData.length.toString()) + 
        (forceUpdate ? ' (Manually updated)' : ' (Updated)');
      console.log('Successfully updated vocabulary data');
      return true;
      
    } catch (fetchError) {
      console.error('Error fetching updated vocabs:', fetchError);
      
      // For manual updates, don't fallback to local file
      if (forceUpdate) {
        statusText.textContent = 'Failed to update vocabulary: ' + fetchError.message;
        return false;
      }
      
      // Fallback to local file for automatic updates
      try {
        const localResponse = await fetch('taiwan_china_vocabs.json');
        const localData = await localResponse.json();
        
        // Store the local data with current timestamp as fallback
        await chrome.storage.local.set({
          'vocabData': localData,
          'vocabUpdateTime': Date.now()
        });
        
        vocabData = localData;
        statusText.textContent = chrome.i18n.getMessage('loadedVocabulary', localData.length.toString()) + ' (Local fallback)';
        console.log('Using local vocabulary file as fallback');
        return true;
        
      } catch (localError) {
        console.error('Error loading local vocabs:', localError);
        statusText.textContent = 'Error loading vocabulary: ' + localError.message;
        return false;
      }
    }
  }

  // Load vocabulary data with update checking
  async function loadVocabularyData() {
    try {
      // Get stored vocabulary data and timestamp
      const result = await chrome.storage.local.get(['vocabData', 'vocabUpdateTime']);
      const storedData = result.vocabData;
      const updateTime = result.vocabUpdateTime;
      
      // Check if data exists and is less than 3 days old
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      const hasValidData = storedData && updateTime && updateTime > threeDaysAgo;
      
      if (hasValidData) {
        // Use stored data if it's recent enough
        vocabData = storedData;
        statusText.textContent = chrome.i18n.getMessage('loadedVocabulary', vocabData.length.toString());
        console.log('Using cached vocabulary data');
             } else {
         // Data is old or missing, fetch from API
         const success = await updateVocabularyData(false);
         if (!success) {
           return;
         }
       }

      // Show the current language
      const currentLanguage = chrome.i18n.getUILanguage();
      console.log('Current language:', currentLanguage);
      
    } catch (error) {
      console.error('Error in vocabulary loading:', error);
      statusText.textContent = 'Error loading vocabulary: ' + error.message;
    }
  }
  
  // Load vocabulary data
  loadVocabularyData();

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

  // Add manual update button
  document.getElementById('update-button')?.addEventListener('click', async () => {
    const updateButton = document.getElementById('update-button');
    
    try {
      // Disable button during update
      updateButton.disabled = true;
      updateButton.textContent = '⏳';
      
      // Force update vocabulary data
      const success = await updateVocabularyData(true);
      
      if (success) {
        // Briefly show success state
        updateButton.textContent = '✅';
        setTimeout(() => {
          updateButton.textContent = '🔄';
          updateButton.disabled = false;
        }, 1500);
      } else {
        // Show error state
        updateButton.textContent = '❌';
        setTimeout(() => {
          updateButton.textContent = '🔄';
          updateButton.disabled = false;
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error in manual update:', error);
      statusText.textContent = 'Error updating vocabulary: ' + error.message;
      
      updateButton.textContent = '❌';
      setTimeout(() => {
        updateButton.textContent = '🔄';
        updateButton.disabled = false;
      }, 2000);
    }
  });

  document.getElementById('auto-scan-switch').addEventListener('change', async function(e) {
    await chrome.storage.sync.set({
      'autoScanSetting': e.target.checked
    });
  });

  // Function to submit vocabulary
  async function submitVocabulary(vocabData) {
    try {
      const response = await fetch('https://radar.aronhack.com/submit-taiwan-china-vocabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vocabData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('Error submitting vocabulary:', error);
      return { success: false, error: error.message };
    }
  }

  // Function to clear the form
  function clearVocabularyForm() {
    document.getElementById('chinese-input').value = '';
    document.getElementById('taiwanese-input').value = '';
    document.getElementById('english-input').value = '';
    document.getElementById('description-input').value = '';
    
    // Reset status field
    updateStatusField(' ');
  }



  // Function to update the submission status field
  function updateStatusField(message, type = 'info') {
    const statusField = document.getElementById('submission-status-field');
    statusField.textContent = message;
    
    // Apply different styles based on type
    switch (type) {
      case 'success':
        statusField.style.color = '#155724';
        statusField.style.backgroundColor = '#d4edda';
        break;
      case 'error':
        statusField.style.color = '#721c24';
        statusField.style.backgroundColor = '#f8d7da';
        break;
      case 'warning':
        statusField.style.color = '#333';
        statusField.style.backgroundColor = '#fff3cd';
        break;
      case 'info':
        statusField.style.color = '#004085';
        statusField.style.backgroundColor = '#cce5ff';
        break;
      default:
        statusField.style.color = '#666';
        statusField.style.backgroundColor = '#f5f5f5';
    }
  }

  // Vocabulary form submission handler
  document.getElementById('vocab-submission-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-vocab-btn');
    const originalText = submitBtn.textContent;
    const statusField = document.getElementById('submission-status-field');
    
    try {
      // Disable submit button and show loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      updateStatusField('Preparing submission...', 'warning');
      
      // Get form data
      const vocabData = {
        chinese: document.getElementById('chinese-input').value.trim(),
        taiwanese: document.getElementById('taiwanese-input').value.trim(),
        english: document.getElementById('english-input').value.trim(),
        description: document.getElementById('description-input').value.trim()
      };
      
      // Validate required fields
      if (!vocabData.chinese || !vocabData.taiwanese) {
        updateStatusField('Error: 中國用語和台灣用語為必填欄位！', 'error');
        return;
      }
      
      // Update status before submission
      updateStatusField('傳送中...', 'info');
      
      // Submit vocabulary
      const result = await submitVocabulary(vocabData);
      
      if (result.success) {
        updateStatusField('新字詞已送出並等待審核，感謝您的貢獻！', 'success');
        
        // Clear form after a short delay
        setTimeout(() => {
          clearVocabularyForm();
        }, 3000);
      } else {
        updateStatusField(`傳送失敗: ${result.error}`, 'error');
      }
      
    } catch (error) {
      console.error('Error in form submission:', error);
      updateStatusField(`錯誤: ${error.message}`, 'error');
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Clear form button handler
  document.getElementById('clear-form-btn').addEventListener('click', () => {
    clearVocabularyForm();
  });

  // Submission form toggle functionality
  const submissionHeader = document.getElementById('submission-header');
  const submissionContent = document.getElementById('submission-content');
  const submissionToggle = document.getElementById('submission-toggle');
  
  submissionHeader.addEventListener('click', () => {
    const isExpanded = submissionContent.style.display !== 'none';
    
    if (isExpanded) {
      // Collapse
      submissionContent.style.display = 'none';
      submissionToggle.classList.remove('expanded');
      submissionToggle.textContent = '▼';
    } else {
      // Expand
      submissionContent.style.display = 'block';
      submissionToggle.classList.add('expanded');
      submissionToggle.textContent = '▲';
    }
  });

  // Copy prompt button functionality
  document.getElementById('copy-prompt-btn').addEventListener('click', async () => {
    const promptText = `請根據這份對照表，將以下文字中的中國用語轉換為台灣用語
https://radar.aronhack.com/get-taiwan-china-vocabs`;
    
    try {
      await navigator.clipboard.writeText(promptText);
      
      // Show success feedback
      const button = document.getElementById('copy-prompt-btn');
      const originalText = button.textContent;
      button.textContent = '已複製！';
      button.style.backgroundColor = '#28a745';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#17a2b8';
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy text: ', err);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = promptText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // Show success feedback
      const button = document.getElementById('copy-prompt-btn');
      const originalText = button.textContent;
      button.textContent = '已複製！';
      button.style.backgroundColor = '#28a745';
      
      // Reset button after 2 seconds
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '#17a2b8';
      }, 2000);
    }
  });
});

// Load setting
document.addEventListener('DOMContentLoaded', async () => {
  const result = await chrome.storage.sync.get(['autoScanSetting']);
  document.getElementById('auto-scan-switch').checked = result.autoScanSetting || false;
});