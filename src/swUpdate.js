// src/swUpdate.js
// Service worker update helper: show a toast when a new version is waiting, and apply it cleanly.
// IMPORTANT: We *override* window.showSwToast/applySwUpdate (not ||=) because index.html defines early fallbacks.

function removeToast() {
  const t = document.getElementById("sw-update-toast");
  if (t) t.remove();
}

function setToastGlobal() {
  window.showSwToast = function (onRefresh) {
    // If already shown, don't duplicate
    const existing = document.getElementById("sw-update-toast");
    if (existing) return;

    const toast = document.createElement("div");
    toast.id = "sw-update-toast";
    toast.className = "sw-toast";
    toast.innerHTML = `
      <div class="sw-toast__inner">
        <span class="sw-toast__text">Update available</span>
        <div class="sw-toast__actions">
          <button class="sw-toast__btn sw-toast__btn--primary" id="sw-refresh">Refresh</button>
          <button class="sw-toast__btn" id="sw-dismiss">Later</button>
        </div>
      </div>
    `;
    document.body.appendChild(toast);

    const refreshBtn = document.getElementById("sw-refresh");
    const dismissBtn = document.getElementById("sw-dismiss");

    if (refreshBtn) {
      refreshBtn.onclick = () => {
        removeToast(); // immediately hide so user sees action
        try { onRefresh?.(); } catch (e) {}
      };
    }
    if (dismissBtn) {
      dismissBtn.onclick = () => removeToast();
    }
  };
}

function setApplyGlobal() {
  window.applySwUpdate = function () {
    let reloaded = false;

    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      removeToast();
      window.location.reload();
    };

    if (!("serviceWorker" in navigator)) {
      reloadOnce();
      return;
    }

    // Reload as soon as the new SW takes control
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });

    navigator.serviceWorker.getRegistration?.().then((reg) => {
      if (reg?.waiting) {
        // Tell SW to activate immediately
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } else {
        // Nothing waiting, just reload
        reloadOnce();
      }
    }).catch(reloadOnce);

    // Safety: if controllerchange doesn't fire (rare), reload anyway.
    setTimeout(reloadOnce, 1500);
  };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  setToastGlobal();
  setApplyGlobal();

  navigator.serviceWorker.register("/sw.js").then((reg) => {
    // If an update is already waiting, show toast
    if (reg.waiting && navigator.serviceWorker.controller) {
      window.showSwToast(() => window.applySwUpdate());
    }

    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (!w) return;

      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          // New version installed and ready
          window.showSwToast(() => window.applySwUpdate());
        }
      });
    });
  });
}

// legacy export used by your src/main.jsx
export const registerServiceWorkerUpdates = registerServiceWorker;
