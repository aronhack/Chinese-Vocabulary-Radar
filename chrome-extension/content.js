// Content script for highlighting vocabulary words
// console.log("Content script loaded");

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    // Simple ping response to check if content script is loaded
    sendResponse({loaded: true});
    // console.log("Ping response sent");
  } else if (request.action === "scan") {
    // console.log("Received scan message");
    
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
        content = content.replace(regex, `<mark class="vocab-highlight" data-vocab="${term}">${term}</mark>`);
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
  
  // console.log(`Highlighted ${highlightedCount} vocabulary words`);
  return highlightedCount;
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
    }
    
    .vocab-highlight:hover {
      background-color: #ffc107 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
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