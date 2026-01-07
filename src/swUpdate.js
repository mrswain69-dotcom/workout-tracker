// src/swUpdate.js
// Compatibility layer for SW update UX.
// Ensures globals used by older bundles are defined:
//   - window.showSwToast
//   - window.applySwUpdate
//
// Exports both:
//   - registerServiceWorkerUpdates (legacy import used by src/main.jsx)
//   - registerServiceWorker (preferred)

function ensureToastGlobal() {
  window.showSwToast = window.showSwToast || function (onRefresh) {
    const existing = document.getElementById("sw-update-toast");
    if (existing) return;

    const toast = document.createElement("div");
    toast.id = "sw-update-toast";
    toast.className = "sw-toast";
    toast.innerHTML = `
      <span>New version available</span>
      <button id="sw-refresh">Refresh</button>
      <button id="sw-dismiss">Later</button>
    `;
    document.body.appendChild(toast);

    document.getElementById("sw-refresh").onclick = () => onRefresh?.();
    document.getElementById("sw-dismiss").onclick = () => toast.remove();
  };
}

function ensureApplyGlobal(regOrWorker) {
  // Define a global function that activates the waiting SW (if any) then reloads.
  window.applySwUpdate = window.applySwUpdate || function () {
    try {
      // If we have a specific worker, tell it to skip waiting.
      const w = regOrWorker?.waiting || regOrWorker;
      if (w && w.postMessage) {
        w.postMessage({ type: "SKIP_WAITING" });
      }
    } finally {
      // Give the SW a moment, then reload.
      setTimeout(() => window.location.reload(), 150);
    }
  };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  ensureToastGlobal();

  navigator.serviceWorker.register("/sw.js").then((reg) => {
    ensureApplyGlobal(reg);

    // If there's already a waiting SW, offer refresh immediately.
    if (reg.waiting && navigator.serviceWorker.controller) {
      window.showSwToast(() => window.applySwUpdate());
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          // Update ready
          ensureApplyGlobal({ waiting: newWorker });
          window.showSwToast(() => window.applySwUpdate());
        }
      });
    });
  });

  // Also listen for SW messages
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_UPDATE_AVAILABLE") {
      window.showSwToast(() => window.applySwUpdate());
    }
  });
}

// Legacy export name used by your src/main.jsx
export const registerServiceWorkerUpdates = registerServiceWorker;
