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
chrome.runtime.onInstalled.addListener((_details: InstallDetails) => {
  // Extension installed or updated
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((
  request: AnalyticsRequest,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { success: boolean }) => void
): boolean => {
  if (request.action === 'logAnalytics') {
    sendResponse({ success: true });
  }

  return true; // Indicates async response
});
