/**
 * IiifPage 直接在当前页面挂载 Mirador，避免依赖外部静态站点的 /mirador 页面。
 */

import { useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { InlineMiradorViewer } from '@/features/iiif/InlineMiradorViewer'
import { buildManifestUrl, buildMiradorViewerUrl } from '@/lib/config/iiif'

const DEFAULT_MANIFEST_URL = 'https://iiif.harvardartmuseums.org/manifests/object/299843'

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

  if (!isEmbeddedShellRoute) {
    return (
      <main style={{ height: '100vh', minHeight: 0, background: '#fff' }}>
        <InlineMiradorViewer
          manifestPath={manifestUrl}
          canvasId={canvasId}
          height="100vh"
          onResolvedManifestChange={setResolvedManifestUrl}
        />
      </main>
    )
  }

  return (
    <main className="container">
      <section className="panel">
        <iframe
          title="Mirador IIIF Viewer"
          src={openInNewWindowUrl}
          style={IFRAME_STYLE}
          allow="fullscreen"
          allowFullScreen
        />
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
