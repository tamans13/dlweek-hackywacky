/**
 * Brainosaur Tab Tracker - Content Script
 * Forwards extension messages to the page via postMessage.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.source !== "brainosaur-extension" || !message.payload) {
    sendResponse({ ok: false });
    return;
  }
  try {
    window.postMessage(
      { source: "brainosaur-extension", payload: message.payload },
      window.location.origin
    );
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
});
