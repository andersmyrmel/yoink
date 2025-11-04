/**
 * Yoink Background Service Worker
 *
 * Handles background tasks for the extension.
 * In MV3, this replaces the background page from MV2.
 */

interface InstallDetails {
  reason: chrome.runtime.OnInstalledReason;
  previousVersion?: string;
}

interface AnalyticsRequest {
  action: 'logAnalytics';
  data: unknown;
}

// Listen for extension installation or updates
chrome.runtime.onInstalled.addListener((details: InstallDetails) => {
  if (details.reason === 'install') {
    console.log('🎨 Yoink extension installed successfully!');
  } else if (details.reason === 'update') {
    console.log(`🎨 Yoink extension updated from version ${details.previousVersion}`);
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((
  request: AnalyticsRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean }) => void
): boolean => {
  console.log('Background received message:', request);

  if (request.action === 'logAnalytics') {
    console.log('Analytics event:', request.data);
    sendResponse({ success: true });
  }

  return true; // Indicates async response
});

/**
 * Update extension badge
 * @param text - Badge text to display
 * @param color - Badge background color
 */
function updateBadge(text: string, color = '#6366f1'): void {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

console.log('🎨 Yoink background service worker started');
