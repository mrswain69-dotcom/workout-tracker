// src/swUpdate.js
//
// Exports BOTH names to stay compatible with older imports:
// - registerServiceWorkerUpdates (legacy name)
// - registerServiceWorker (preferred name)

function setupGlobalToast() {
  // Define globally so App won't crash if any part references it.
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

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  setupGlobalToast();

  navigator.serviceWorker.register("/sw.js").then((reg) => {
    // If there's already a waiting SW, offer refresh immediately.
    if (reg.waiting && navigator.serviceWorker.controller) {
      window.showSwToast(() => {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      });
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          window.showSwToast(() => {
            newWorker.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_UPDATE_AVAILABLE") {
      window.showSwToast(() => window.location.reload());
    }
  });
}

// Legacy export name used by src/main.jsx in your repo right now.
export const registerServiceWorkerUpdates = registerServiceWorker;
