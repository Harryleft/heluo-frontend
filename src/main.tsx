import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@/styles/global.css'
import { App } from '@/app/App'
import { loadRuntimeConfig } from '@/lib/runtime/runtimeConfig'

const ROOT_ELEMENT_ID = 'root'
const EXTENSION_MESSAGE_CHANNEL_ERROR =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received'

/**
 * 过滤浏览器扩展导致的 runtime.lastError 噪音，避免污染应用错误链路。
 * 仅处理该已知报错文本，不吞掉其他业务错误。
 */
function isExtensionMessageChannelError(message: string): boolean {
  return message.includes(EXTENSION_MESSAGE_CHANNEL_ERROR)
}

function stringifyUnhandledReason(reason: unknown): string {
  if (typeof reason === 'string') return reason
  if (reason instanceof Error) return reason.message
  return String(reason || '')
}

function registerUnhandledRejectionFilter(): void {
  window.addEventListener('unhandledrejection', (event) => {
    const reasonText = stringifyUnhandledReason(event.reason)
    if (isExtensionMessageChannelError(reasonText)) {
      event.preventDefault()
    }
  })
}

function renderApp(): void {
  const rootElement = document.getElementById(ROOT_ELEMENT_ID) as HTMLElement | null
  if (!rootElement) {
    throw new Error(`未找到应用挂载节点: #${ROOT_ELEMENT_ID}`)
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

function bootstrap(): void {
  registerUnhandledRejectionFilter()
  void loadRuntimeConfig()
  renderApp()
}

bootstrap()
