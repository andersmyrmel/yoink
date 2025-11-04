/**
 * Yoink Background Service Worker
 *
 * This service worker handles background tasks for the extension.
 * In MV3, this replaces the background page from MV2.
 *
 * Current responsibilities:
 * - Handle extension lifecycle events
 * - Log extension installation/updates
 * - Can be extended for future features like badge updates, notifications, etc.
 */

// Listen for extension installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎨 Yoink extension installed successfully!');

    // You could open a welcome page here if desired
    // chrome.tabs.create({ url: 'welcome.html' });
  } else if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    console.log(`🎨 Yoink extension updated from version ${previousVersion}`);
  }
});

// Listen for messages from popup or content scripts
// (Currently not used, but available for future features)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  // Example: Handle different message types
  if (request.action === 'logAnalytics') {
    // Could log analytics events here
    console.log('Analytics event:', request.data);
    sendResponse({ success: true });
  }

  // Return true to indicate async response
  return true;
});

// Example: Update extension badge based on events
// (Not currently used, but available for future features)
function updateBadge(text, color = '#6366f1') {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Log when service worker starts
console.log('🎨 Yoink background service worker started');

/**
 * Future enhancement ideas:
 *
 * 1. Badge updates: Show count of extracted styles
 *    chrome.action.setBadgeText({ text: '5' })
 *
 * 2. Context menus: Right-click menu for quick actions
 *    chrome.contextMenus.create({...})
 *
 * 3. Keyboard shortcuts: Global shortcuts for scanning
 *    chrome.commands.onCommand.addListener(...)
 *
 * 4. Storage sync: Save user preferences
 *    chrome.storage.sync.set({...})
 *
 * 5. Analytics: Track usage patterns (privacy-respecting)
 *
 * 6. Background processing: Handle long-running tasks
 *    without blocking the UI
 */
