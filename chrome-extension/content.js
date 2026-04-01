/**
 * Brainosaur Content Script
 * Bridges web app postMessage <-> extension runtime messaging.
 */

const APP_SOURCE = "brainosaur-webapp";
const EXT_SOURCE = "brainosaur-extension";

console.log("[Brainosaur content.js] Script loaded, listening for webapp messages...");

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const data = event.data;
  console.log("[Brainosaur content.js] Received postMessage event:", data);

  if (!data || data.source !== APP_SOURCE || !data.requestId || !data.payload) {
    console.log("[Brainosaur content.js] Not a valid brainosaur message, ignoring");
    return;
  }

  console.log("[Brainosaur content.js] Valid message, bridging to runtime.sendMessage:", data.payload);

  chrome.runtime.sendMessage(data.payload, (response) => {
    const error = chrome.runtime.lastError?.message || null;
    console.log("[Brainosaur content.js] Runtime response:", response, "error:", error);
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
  console.log("[Brainosaur content.js] Received chrome.runtime.onMessage:", message);
  try {
    if (message?.source === EXT_SOURCE && message?.payload) {
      console.log("[Brainosaur content.js] Forwarding extension message to webapp:", message.payload);
      window.postMessage({ source: EXT_SOURCE, payload: message.payload }, window.location.origin);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: true, ignored: true });
  } catch (e) {
    console.error("[Brainosaur content.js] Exception:", e);
    sendResponse({ ok: false, error: String(e) });
  }
});

