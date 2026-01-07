Update Toast Fix

This patch fixes the blank screen caused by:
ReferenceError: showSwToast is not defined

What to do:
1) Overwrite: src/swUpdate.js
2) Commit & push:
   git add src/swUpdate.js
   git commit -m "Fix SW update toast (define showSwToast)"
   git push

Notes:
- No other files are required for this fix.
- If you previously installed the PWA on tablets/phones, you may need to clear site data once or reinstall the PWA to flush the old cached shell.
