/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REACT_LEAFLET_JS_URL?: string
  readonly REACT_LEAFLET_CSS_URL?: string
  readonly REACT_MAP_TILE_URL?: string
  readonly REACT_MAP_ATTRIBUTION?: string
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
