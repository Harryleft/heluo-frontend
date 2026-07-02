/**
 * InlineMiradorViewer 负责直接在当前组件树中挂载 Mirador 本体。
 */

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { resolveIiifManifestUrl } from '@/features/iiif/manifestResolver'

const DEFAULT_HEIGHT = '75vh'
const DEFAULT_MIN_HEIGHT = '400px'
const LOADING_LABEL = '正在加载 Mirador...'
const ERROR_LABEL = 'Mirador 加载失败，请稍后重试。'

const VIEWER_WRAPPER_STYLE: CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  overflow: 'hidden',
  background: '#fff',
}
const VIEWER_INNER_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
}
const STATUS_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  color: '#6b7280',
  background: '#fff',
}

interface InlineMiradorViewerProps {
  manifestPath: string
  canvasId?: string
  height?: string
  onResolvedManifestChange?: (manifestUrl: string) => void
}

export function InlineMiradorViewer({
  manifestPath,
  canvasId = '',
  height = DEFAULT_HEIGHT,
  onResolvedManifestChange,
}: InlineMiradorViewerProps): JSX.Element {
  const reactId = useId()
  const [resolvedManifestUrl, setResolvedManifestUrl] = useState('')
  const [loadError, setLoadError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const containerId = useMemo(() => `mirador-inline-${reactId.replace(/[:]/g, '')}`, [reactId])

  useEffect(() => {
    let cancelled = false

    async function resolveManifest(): Promise<void> {
      setIsLoading(true)
      setLoadError('')

      try {
        const manifestUrl = await resolveIiifManifestUrl(manifestPath)
        if (cancelled) return
        setResolvedManifestUrl(manifestUrl)
        onResolvedManifestChange?.(manifestUrl)
      } catch (error) {
        if (cancelled) return
        setResolvedManifestUrl('')
        setLoadError(String(error instanceof Error ? error.message : error) || ERROR_LABEL)
        setIsLoading(false)
      }
    }

    void resolveManifest()

    return () => {
      cancelled = true
    }
  }, [manifestPath, onResolvedManifestChange])

  useEffect(() => {
    let disposed = false

    async function mountMirador(): Promise<void> {
      if (!resolvedManifestUrl) return
      setIsLoading(true)
      setLoadError('')

      try {
        const host = document.getElementById(containerId)
        if (!host) throw new Error('Mirador 容器不存在')
        host.innerHTML = ''

        const module = await import('mirador')
        if (disposed) return

        module.viewer({
          id: containerId,
          windows: [
            {
              manifestId: resolvedManifestUrl,
              canvasId: canvasId || undefined,
            },
          ],
        })

        if (!disposed) setIsLoading(false)
      } catch (error) {
        if (disposed) return
        setIsLoading(false)
        setLoadError(String(error instanceof Error ? error.message : error) || ERROR_LABEL)
      }
    }

    void mountMirador()

    return () => {
      disposed = true
      const host = document.getElementById(containerId)
      if (host) host.innerHTML = ''
    }
  }, [canvasId, containerId, resolvedManifestUrl])

  return (
    <div
      style={{
        ...VIEWER_WRAPPER_STYLE,
        height,
        minHeight: DEFAULT_MIN_HEIGHT,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div id={containerId} style={{ ...VIEWER_INNER_STYLE }} />
        {(isLoading || loadError) && (
          <div style={{ ...STATUS_STYLE, position: 'absolute', top: 0, left: 0 }}>
            {loadError || LOADING_LABEL}
          </div>
        )}
      </div>
    </div>
  )
}
