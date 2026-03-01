/**
 * Brainosaur Content Script
 * Bridges web app postMessage <-> extension runtime messaging.
 */

const APP_SOURCE = "brainosaur-webapp";
const EXT_SOURCE = "brainosaur-extension";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const data = event.data;
  if (!data || data.source !== APP_SOURCE || !data.requestId || !data.payload) return;

  chrome.runtime.sendMessage(data.payload, (response) => {
    const error = chrome.runtime.lastError?.message || null;
    window.postMessage(
      {
        source: EXT_SOURCE,
        bridge: true,
        requestId: data.requestId,
        response: response || null,
        error
      },
      window.location.origin
    );
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message?.source === EXT_SOURCE && message?.payload) {
      window.postMessage({ source: EXT_SOURCE, payload: message.payload }, window.location.origin);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: true, ignored: true });
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
});

