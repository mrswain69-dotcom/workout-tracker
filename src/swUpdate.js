// src/swUpdate.js
// Keeps compatibility with older imports + globals, but ensures the toast disappears after refresh.

function removeToast() {
  const t = document.getElementById("sw-update-toast");
  if (t) t.remove();
}

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

    document.getElementById("sw-refresh").onclick = () => {
      removeToast();
      onRefresh?.();
    };
    document.getElementById("sw-dismiss").onclick = () => removeToast();
  };
}

function ensureApplyGlobal() {
  window.applySwUpdate = window.applySwUpdate || function () {
    let reloaded = false;
    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      removeToast();
      window.location.reload();
    };

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });

      navigator.serviceWorker.getRegistration?.().then((reg) => {
        if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        else reloadOnce();
      }).catch(reloadOnce);

      setTimeout(reloadOnce, 1200);
    } else {
      reloadOnce();
    }
  };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  ensureToastGlobal();
  ensureApplyGlobal();

  navigator.serviceWorker.register("/sw.js").then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      window.showSwToast(() => window.applySwUpdate());
    }

    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          window.showSwToast(() => window.applySwUpdate());
        }
      });
    });
  });
}

export const registerServiceWorkerUpdates = registerServiceWorker;
