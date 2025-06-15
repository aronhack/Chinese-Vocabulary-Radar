// Content script for highlighting vocabulary words
// console.log("Content script loaded");

// Global variables for navigation
let currentHighlightIndex = -1;
let allHighlights = [];
let navigationActive = false;
let lastNavigationTime = 0;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    // Simple ping response to check if content script is loaded
    sendResponse({loaded: true});
    // console.log("Ping response sent");
  } else if (request.action === "scan") {
    // console.log("Received scan message");
    
    // Check if navigation was recently active (within last 30 seconds)
    const timeSinceLastNav = Date.now() - lastNavigationTime;
    const isAutoScan = request.isAutoScan || false;
    
    // Skip auto-scan if navigation was recent or currently active
    if (isAutoScan && (navigationActive || timeSinceLastNav < 30000)) {
      console.log("Skipping auto-scan due to recent navigation activity");
      sendResponse({
        success: true, 
        message: "Auto-scan skipped - navigation active",
        highlightedCount: allHighlights.length,
        skipped: true
      });
      return true;
    }
    
    try {
      const highlightedCount = highlightVocabulary(request.vocabData || []);
      sendResponse({
        success: true, 
        message: "Scan completed",
        highlightedCount: highlightedCount
      });
    } catch (error) {
      console.error("Error during scan:", error);
      sendResponse({
        success: false, 
        message: "Scan failed: " + error.message
      });
    }
  } else if (request.action === "clearHighlights") {
    // console.log("Clearing highlights");
    
    try {
      clearHighlights();
      sendResponse({success: true, message: "Highlights cleared"});
    } catch (error) {
      console.error("Error clearing highlights:", error);
      sendResponse({success: false, message: "Failed to clear highlights"});
    }
  } else if (request.action === "jumpToNext") {
    // console.log("Jumping to next highlight");
    
    try {
      // Add some debugging
      console.log(`Before jumpToNext - currentIndex: ${currentHighlightIndex}, total highlights: ${allHighlights.length}`);
      
      const result = jumpToNextHighlight();
      
      console.log(`After jumpToNext - currentIndex: ${result.currentIndex}, total: ${result.totalCount}`);
      
      sendResponse({
        success: true, 
        currentIndex: result.currentIndex,
        totalCount: result.totalCount,
        hasNext: result.hasNext,
        message: chrome.i18n.getMessage('highlightNavigation', [
          (result.currentIndex + 1).toString(),
          result.totalCount.toString()
        ])
      });
    } catch (error) {
      console.error("Error jumping to next highlight:", error);
      sendResponse({
        success: false, 
        message: "Failed to jump to next highlight: " + error.message
      });
    }
  } else if (request.action === "jumpToPrevious") {
    // console.log("Jumping to previous highlight");
    
    try {
      // Add some debugging  
      console.log(`Before jumpToPrevious - currentIndex: ${currentHighlightIndex}, total highlights: ${allHighlights.length}`);
      
      const result = jumpToPreviousHighlight();
      
      console.log(`After jumpToPrevious - currentIndex: ${result.currentIndex}, total: ${result.totalCount}`);
      
      sendResponse({
        success: true, 
        currentIndex: result.currentIndex,
        totalCount: result.totalCount,
        hasPrevious: result.hasPrevious,
        message: chrome.i18n.getMessage('highlightNavigation', [
          (result.currentIndex + 1).toString(),
          result.totalCount.toString()
        ])
      });
    } catch (error) {
      console.error("Error jumping to previous highlight:", error);
      sendResponse({
        success: false, 
        message: chrome.i18n.getMessage('highlightNavigationFailed', [
          error.message
        ])
      });
    }
  }
  
  // Return true to indicate async response
  return true;
});

// Function to highlight vocabulary words
function highlightVocabulary(vocabData) {
  let highlightedCount = 0;
  
  // Clear existing highlights first
  clearHighlights();
  
  if (!vocabData || vocabData.length === 0) {
    // console.log("No vocabulary data provided");
    return 0;
  }
  
  // Create array of search terms
  const searchTerms = vocabData.map(item => {
    // Handle different data structures
    if (typeof item === 'string') {
      return item;
    } else if (item.chinese) {
      return item.chinese;
    } else if (item.taiwanese) {
      return item.taiwanese;
    }
    return null;
  }).filter(term => term !== null);
  
  // console.log("Searching for terms:", searchTerms);
  
  // Get all text nodes in the document
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style elements
        const parent = node.parentElement;
        if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
          return NodeFilter.FILTER_REJECT;
        }
        // Only process nodes with actual content
        return node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  // Process each text node
  textNodes.forEach(textNode => {
    let content = textNode.textContent;
    let hasMatches = false;
    
    // Check for each search term
    searchTerms.forEach(term => {
      if (content.includes(term)) {
        hasMatches = true;
        // Create regex for global replacement (case sensitive for Chinese/Japanese)
        const regex = new RegExp(escapeRegExp(term), 'g');
        content = content.replace(regex, `<mark class="vocab-highlight" data-vocab="${term}" tabindex="-1">${term}</mark>`);
      }
    });
    
    // If we found matches, replace the text node with highlighted HTML
    if (hasMatches) {
      const span = document.createElement('span');
      span.innerHTML = content;
      span.classList.add('vocab-highlight-container');
      
      // Count the highlights in this node
      const highlights = span.querySelectorAll('.vocab-highlight');
      highlightedCount += highlights.length;
      
      // Replace the text node with the new span
      textNode.parentNode.replaceChild(span, textNode);
    }
  });
  
  // Add CSS styles for highlighting
  addHighlightStyles();
  
  // Update the highlights array for navigation
  updateHighlightsArray();
  
  // console.log(`Highlighted ${highlightedCount} vocabulary words`);
  return highlightedCount;
}

// Function to update the highlights array for navigation
function updateHighlightsArray() {
  // Get fresh list of highlights and sort them by their position in the document
  const newHighlights = Array.from(document.querySelectorAll('.vocab-highlight'));
  
  // Sort highlights by their position in the document to ensure consistent order
  newHighlights.sort((a, b) => {
    const position = a.compareDocumentPosition(b);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1; // a comes before b
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1; // a comes after b
    }
    return 0; // same position
  });
  
  // Add unique IDs to each highlight for tracking
  newHighlights.forEach((highlight, index) => {
    highlight.setAttribute('data-highlight-id', index);
  });
  
  // Only reset index if this is a fresh scan (no existing highlights)
  if (allHighlights.length === 0) {
    currentHighlightIndex = -1;
  }
  
  allHighlights = newHighlights;
  
  // Debug logging
  console.log(`Updated highlights array: ${allHighlights.length} highlights found, current index: ${currentHighlightIndex}`);
}

// Function to jump to next highlight
function jumpToNextHighlight() {
  // Mark navigation as active
  navigationActive = true;
  lastNavigationTime = Date.now();
  
  if (allHighlights.length === 0) {
    // Try to refresh highlights if array is empty
    updateHighlightsArray();
    if (allHighlights.length === 0) {
      navigationActive = false;
      throw new Error("No highlights found on the page");
    }
  }
  
  // Remove current highlight styling from all elements
  allHighlights.forEach(highlight => {
    highlight.classList.remove('vocab-highlight-current');
  });
  
  // Increment index
  currentHighlightIndex++;
  
  // Wrap around if at the end
  if (currentHighlightIndex >= allHighlights.length) {
    currentHighlightIndex = 0;
  }
  
  // Verify the highlight still exists and is valid
  let currentHighlight = allHighlights[currentHighlightIndex];
  
  // If the highlight is no longer in the DOM, refresh and try again
  if (!currentHighlight || !document.contains(currentHighlight)) {
    console.log("Highlight no longer in DOM, refreshing...");
    updateHighlightsArray();
    
    // Reset to a safe index
    if (currentHighlightIndex >= allHighlights.length) {
      currentHighlightIndex = 0;
    }
    
    currentHighlight = allHighlights[currentHighlightIndex];
  }
  
  if (currentHighlight && document.contains(currentHighlight)) {
    currentHighlight.classList.add('vocab-highlight-current');
    currentHighlight.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });
    
    // Focus the element for accessibility
    currentHighlight.focus();
  } else {
    navigationActive = false;
    throw new Error("Could not find valid highlight to navigate to");
  }
  
  // Reset navigation active flag after a short delay
  setTimeout(() => {
    navigationActive = false;
  }, 1000);
  
  return {
    currentIndex: currentHighlightIndex,
    totalCount: allHighlights.length,
    hasNext: currentHighlightIndex < allHighlights.length - 1
  };
}

// Function to jump to previous highlight
function jumpToPreviousHighlight() {
  // Mark navigation as active
  navigationActive = true;
  lastNavigationTime = Date.now();
  
  if (allHighlights.length === 0) {
    // Try to refresh highlights if array is empty
    updateHighlightsArray();
    if (allHighlights.length === 0) {
      navigationActive = false;
      throw new Error("No highlights found on the page");
    }
  }
  
  // Remove current highlight styling from all elements
  allHighlights.forEach(highlight => {
    highlight.classList.remove('vocab-highlight-current');
  });
  
  // Decrement index
  currentHighlightIndex--;
  
  // Wrap around if at the beginning
  if (currentHighlightIndex < 0) {
    currentHighlightIndex = allHighlights.length - 1;
  }
  
  // Verify the highlight still exists and is valid
  let currentHighlight = allHighlights[currentHighlightIndex];
  
  // If the highlight is no longer in the DOM, refresh and try again
  if (!currentHighlight || !document.contains(currentHighlight)) {
    console.log("Highlight no longer in DOM, refreshing...");
    updateHighlightsArray();
    
    // Reset to a safe index
    if (currentHighlightIndex >= allHighlights.length) {
      currentHighlightIndex = allHighlights.length - 1;
    }
    
    currentHighlight = allHighlights[currentHighlightIndex];
  }
  
  if (currentHighlight && document.contains(currentHighlight)) {
    currentHighlight.classList.add('vocab-highlight-current');
    currentHighlight.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    });
    
    // Focus the element for accessibility
    currentHighlight.focus();
  } else {
    navigationActive = false;
    throw new Error("Could not find valid highlight to navigate to");
  }
  
  // Reset navigation active flag after a short delay
  setTimeout(() => {
    navigationActive = false;
  }, 1000);
  
  return {
    currentIndex: currentHighlightIndex,
    totalCount: allHighlights.length,
    hasPrevious: currentHighlightIndex > 0
  };
}

// Function to clear all highlights
function clearHighlights() {
  // Remove all highlight containers
  const containers = document.querySelectorAll('.vocab-highlight-container');
  containers.forEach(container => {
    // Replace with plain text
    const textNode = document.createTextNode(container.textContent);
    container.parentNode.replaceChild(textNode, container);
  });
  
  // Remove highlight styles
  const styleElement = document.getElementById('vocab-highlight-styles');
  if (styleElement) {
    styleElement.remove();
  }
  
  // Reset navigation variables
  allHighlights = [];
  currentHighlightIndex = -1;
  
  // console.log("Highlights cleared");
}

// Function to add CSS styles for highlighting
function addHighlightStyles() {
  // Check if styles already exist
  if (document.getElementById('vocab-highlight-styles')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'vocab-highlight-styles';
  style.textContent = `
    .vocab-highlight {
      background-color: #ffeb3b !important;
      color: #000 !important;
      padding: 1px 2px !important;
      border-radius: 2px !important;
      font-weight: bold !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      outline: none !important;
    }
    
    .vocab-highlight:hover {
      background-color: #ffc107 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
    }
    
    .vocab-highlight-current {
      background-color: #ff5722 !important;
      color: white !important;
      box-shadow: 0 2px 8px rgba(255, 87, 34, 0.5) !important;
      border: 2px solid #d84315 !important;
      animation: vocab-pulse 1s ease-in-out !important;
    }
    
    @keyframes vocab-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
    
    .vocab-highlight-container {
      display: inline !important;
    }
  `;
  
  document.head.appendChild(style);
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Add keyboard shortcuts for navigation
document.addEventListener('keydown', function(e) {
  // Only activate if we have highlights and the user isn't typing in an input field
  if (allHighlights.length > 0 && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'ArrowDown' || e.key === 'n') {
        e.preventDefault();
        jumpToNextHighlight();
      } else if (e.key === 'ArrowUp' || e.key === 'p') {
        e.preventDefault();
        jumpToPreviousHighlight();
      }
    }
  }
});

// Function to verify highlights array integrity (for debugging)
function verifyHighlightsIntegrity() {
  const actualHighlights = document.querySelectorAll('.vocab-highlight');
  console.log(`Verification: Expected ${allHighlights.length}, Found ${actualHighlights.length}`);
  
  // Check if all highlights in our array still exist in the DOM
  let validCount = 0;
  allHighlights.forEach((highlight, index) => {
    if (document.contains(highlight)) {
      validCount++;
    } else {
      console.log(`Highlight at index ${index} is no longer in DOM`);
    }
  });
  
  console.log(`Valid highlights in array: ${validCount}/${allHighlights.length}`);
  return validCount === allHighlights.length && allHighlights.length === actualHighlights.length;
}