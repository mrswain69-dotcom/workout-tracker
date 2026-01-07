// src/swUpdate.js

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Global function used by the app to show the update toast.
  // Defining it on window prevents ReferenceError crashes if called from anywhere.
  window.showSwToast = function (onRefresh) {
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
      onRefresh();
    };
    document.getElementById("sw-dismiss").onclick = () => {
      toast.remove();
    };
  };

  navigator.serviceWorker.register("/sw.js").then((reg) => {
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
