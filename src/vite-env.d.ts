/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REACT_AMAP_KEY?: string
  readonly REACT_AMAP_SECURITY_JS_CODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'mirador' {
  export interface MiradorConfig {
    id: string
    windows?: Array<{ manifestId: string; canvasId?: string }>
    workspace?: { showZoomControls?: boolean }
    workspaceControlPanel?: { enabled?: boolean }
    language?: string
  }

  export const viewer: (config: MiradorConfig) => void
}
