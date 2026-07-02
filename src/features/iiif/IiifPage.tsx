/**
 * IiifPage 直接在当前页面挂载 Mirador，避免依赖外部静态站点的 /mirador 页面。
 */

import { useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { InlineMiradorViewer } from '@/features/iiif/InlineMiradorViewer'
import { buildManifestUrl, buildMiradorViewerUrl } from '@/lib/config/iiif'

const DEFAULT_MANIFEST_URL = 'https://iiif.harvardartmuseums.org/manifests/object/299843'
const OPEN_IN_NEW_WINDOW_LABEL = '新窗口打开 Mirador'

const LINK_WRAPPER_STYLE: CSSProperties = { marginTop: '0.5rem' }
const IFRAME_STYLE: CSSProperties = {
  width: '100%',
  height: '75vh',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  background: '#fff',
}

export function IiifPage(): JSX.Element {
  const location = useLocation()
  const [params] = useSearchParams()
  const [resolvedManifestUrl, setResolvedManifestUrl] = useState('')
  const manifestUrl = useMemo(() => _resolveManifestUrl(params.get('manifest')), [params])
  const canvasId = useMemo(() => String(params.get('canvas') || '').trim(), [params])
  const isEmbeddedShellRoute = useMemo(() => location.pathname === '/iiif', [location.pathname])
  const openInNewWindowUrl = useMemo(
    () => _buildAbsoluteViewerUrl(resolvedManifestUrl || manifestUrl, canvasId),
    [resolvedManifestUrl, manifestUrl, canvasId],
  )

  return (
    <main className="container">
      <section className="panel">
        <h1>Mirador 查看器</h1>
        <p className="muted">当前页面直接加载项目内 Mirador，保持原有查看器展示效果。</p>
        <p style={LINK_WRAPPER_STYLE}>
          <a href={openInNewWindowUrl} target="_blank" rel="noopener noreferrer">{OPEN_IN_NEW_WINDOW_LABEL}</a>
        </p>
      </section>
      <section className="panel">
        {isEmbeddedShellRoute ? (
          <iframe
            title="Mirador IIIF Viewer"
            src={openInNewWindowUrl}
            style={IFRAME_STYLE}
            allow="fullscreen"
            allowFullScreen
          />
        ) : (
          <InlineMiradorViewer
            manifestPath={manifestUrl}
            canvasId={canvasId}
            height="75vh"
            onResolvedManifestChange={setResolvedManifestUrl}
          />
        )}
      </section>
    </main>
  )
}

function _resolveManifestUrl(rawManifest: string | null): string {
  const manifest = rawManifest || DEFAULT_MANIFEST_URL
  return buildManifestUrl(manifest)
}

function _buildAbsoluteViewerUrl(manifestPath: string, canvasId = ''): string {
  const viewerUrl = buildMiradorViewerUrl(manifestPath, canvasId)
  if (!viewerUrl) return ''
  if (/^https?:\/\//i.test(viewerUrl)) return viewerUrl
  if (typeof window === 'undefined' || !window.location?.origin) return viewerUrl
  return new URL(viewerUrl, window.location.origin).toString()
}
