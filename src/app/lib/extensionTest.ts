/**
 * Quick test script to debug chrome.runtime availability
 */

export function testExtensionConnection() {
  console.log("=== EXTENSION CONNECTION TEST ===");
  console.log("window.chrome exists?", !!window.chrome);
  console.log("window.chrome.runtime exists?", !!window.chrome?.runtime);
  console.log("window.chrome.runtime.sendMessage exists?", !!window.chrome?.runtime?.sendMessage);
  
  if (!window.chrome?.runtime?.sendMessage) {
    console.error("❌ chrome.runtime.sendMessage NOT available!");
    console.error("This page may not have extension access.");
    return false;
  }

  console.log("✓ chrome.runtime.sendMessage is available");
  
  // Try a simple message
  console.log("📤 Sending test message...");
  window.chrome.runtime.sendMessage(
    { type: "GET_STATUS" },
    (response: any) => {
      const err = window.chrome?.runtime?.lastError;
      if (err) {
        console.error("❌ Test failed:", err.message);
      } else {
        console.log("✓ Test success:", response);
      }
    }
  );
  
  return true;
}

// Export for manual testing in console
(window as any).testExtensionConnection = testExtensionConnection;
