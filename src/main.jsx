import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './groups/GroupHub.css'
import './groups/GroupMobilePolish.css'
import './components/progress/VerifiedActivityInteractions.css'
import { registerServiceWorkerUpdates } from './swUpdate.js'

const GROUP_JOIN_STORAGE_KEY = 'wt_group_join_code'

function armGroupJoinDeepLink() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  let joinCode = ''
  try {
    joinCode = new URL(window.location.href).searchParams.get('groupJoin') || ''
  } catch {}
  joinCode = String(joinCode || '').trim()
  if (!joinCode) return

  try { window.sessionStorage.setItem(GROUP_JOIN_STORAGE_KEY, joinCode) } catch {}

  const openGroups = () => {
    const button = document.querySelector('[aria-label="Open Groups"]')
    if (!button) return false
    button.click()
    return true
  }

  if (openGroups()) return

  const observer = new MutationObserver(() => {
    if (openGroups()) observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.addEventListener('beforeunload', () => observer.disconnect(), { once: true })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

armGroupJoinDeepLink()
registerServiceWorkerUpdates()
