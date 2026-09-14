import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { StoreProvider } from './store'
import { TimersProvider } from './timers'
import { ToastProvider } from './components/Toast'
import './lib/install'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <StoreProvider>
        <TimersProvider>
          <RouterProvider router={router} />
        </TimersProvider>
      </StoreProvider>
    </ToastProvider>
  </StrictMode>,
)
