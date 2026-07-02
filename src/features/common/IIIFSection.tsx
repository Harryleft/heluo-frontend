/**
 * IIIFSection 负责在详情页展示 IIIF 图像入口，支持内嵌与跳转两种模式。
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { resolveIiifManifestUrl } from '@/features/iiif/manifestResolver'
import { buildManifestUrl, buildMiradorViewerUrl } from '@/lib/config/iiif'

const DEFAULT_SECTION_HEIGHT = 'calc(100vh - 96px)'
const DEFAULT_LINK_LABEL = '在 Mirador 打开'
const DEFAULT_PREVIEW_LABEL = '图像预览'
const DEFAULT_RESOURCE_LABEL = '图像资源'
const DEFAULT_EMBEDDED_BUTTON_LABEL = '点击加载图像查看器'
const DEFAULT_POPUP_LABEL = '新窗口打开 Mirador'
const DEFAULT_VOLUME_HEAD_NAV_LABEL = '按卷定位'
const DEFAULT_VOLUME_HEAD_LOADING_LABEL = '正在加载卷次定位...'
const DEFAULT_FULLSCREEN_LABEL = '全屏查看'
const DEFAULT_EXIT_FULLSCREEN_LABEL = '退出全屏'

const SECTION_STYLE: CSSProperties = { marginBottom: '16px' }
const SECTION_TITLE_STYLE: CSSProperties = { fontSize: '16px', fontWeight: 600, marginBottom: '12px' }
const LINK_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  background: 'var(--primary, #003366)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-md, 8px)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  textDecoration: 'none',
}
const LOAD_BUTTON_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '200px',
  background: '#f5f5f5',
  border: '2px dashed #d9d9d9',
  borderRadius: '8px',
  cursor: 'pointer',
  color: '#666',
}
const MANIFEST_COUNT_STYLE: CSSProperties = { marginTop: '8px' }
const POPUP_LINK_WRAPPER_STYLE: CSSProperties = { marginTop: '10px' }
const VOLUME_HEAD_NAV_STYLE: CSSProperties = { marginBottom: '12px' }
const VOLUME_HEAD_TITLE_STYLE: CSSProperties = { fontSize: '13px', marginBottom: '8px' }
const VOLUME_HEAD_LIST_STYLE: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '8px' }
const VOLUME_HEAD_BUTTON_STYLE: CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #d9d9d9',
  borderRadius: '6px',
  background: '#fff',
  color: '#1f2937',
  cursor: 'pointer',
  fontSize: '13px',
}
const VOLUME_HEAD_BUTTON_ACTIVE_STYLE: CSSProperties = {
  borderColor: '#003366',
  background: '#003366',
  color: '#fff',
}
const FULLSCREEN_BUTTON_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  background: '#f0f0f0',
  border: '1px solid #d9d9d9',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  color: '#333',
}
const VIEWER_WRAPPER_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  zIndex: 0,
}
const IFRAME_STYLE: CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  background: '#fff',
}

/**
 * IIIFLink 组件属性
 */
interface IIIFLinkProps {
  /** IIIF Manifest URL */
  manifestUrl: string
  /** 显示标签 */
  label?: string
  /** 是否在新窗口打开 */
  openInNewTab?: boolean
}

/**
 * IIIFLink - 跳转到 IIIF 查看器的链接组件
 */
function IIIFLink({ manifestUrl, label = DEFAULT_LINK_LABEL, openInNewTab = true }: IIIFLinkProps): JSX.Element {
  const miradorUrl = _buildMiradorUrl(manifestUrl)

  return (
    <a
      href={miradorUrl || '#'}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      style={LINK_STYLE}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      {label}
    </a>
  )
}

/**
 * IIIFSection 组件属性
 */
interface IIIFSectionProps {
  /** IIIF Manifest URL 列表 */
  manifests: string[]
  /** 是否内嵌显示查看器 */
  embedded?: boolean
  /** 内嵌模式是否自动加载 */
  autoLoadEmbedded?: boolean
  /** 是否显示卷次定位 */
  showVolumeHeadNavigator?: boolean
  /** 是否隐藏标题 */
  hideTitle?: boolean
  /** 是否隐藏"新窗口打开 Mirador"按钮 */
  hidePopupLink?: boolean
  /** 内嵌模式下的高度 */
  height?: string
}

interface IiifVolumeHead {
  volumeLabel: string
  canvasId: string
  canvasLabel?: string
  pageIndex?: number
}

interface IiifVolumeHeadsApiResponse {
  success?: boolean
  data?: {
    volumeHeads?: IiifVolumeHead[]
  }
}

/**
 * IIIFSection - 在详情页中显示 IIIF 相关内容
 */
export function IIIFSection({
  manifests,
  embedded = false,
  autoLoadEmbedded = false,
  showVolumeHeadNavigator = false,
  hideTitle = false,
  hidePopupLink = false,
  height = DEFAULT_SECTION_HEIGHT,
}: IIIFSectionProps): JSX.Element | null {
  const [showViewer, setShowViewer] = useState(false)
  const [selectedCanvasId, setSelectedCanvasId] = useState('')
  const [volumeHeads, setVolumeHeads] = useState<IiifVolumeHead[]>([])
  const [isLoadingVolumeHeads, setIsLoadingVolumeHeads] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [resolvedManifestUrl, setResolvedManifestUrl] = useState('')
  const viewerWrapperRef = useRef<HTMLDivElement | null>(null)
  const hasManifests = Array.isArray(manifests) && manifests.length > 0
  const firstManifest = hasManifests ? manifests[0] : ''
  const effectiveManifestUrl = resolvedManifestUrl || buildManifestUrl(firstManifest)
  const shouldShowViewer = autoLoadEmbedded || showViewer
  const iframeSrc = shouldShowViewer ? _buildAbsoluteMiradorUrl(effectiveManifestUrl || firstManifest, selectedCanvasId) : ''

  useEffect(() => {
    setSelectedCanvasId('')
  }, [firstManifest])

  useEffect(() => {
    let cancelled = false

    async function loadResolvedManifest(): Promise<void> {
      if (!firstManifest) {
        setResolvedManifestUrl('')
        return
      }

      try {
        const manifestUrl = await resolveIiifManifestUrl(firstManifest)
        if (!cancelled) setResolvedManifestUrl(manifestUrl)
      } catch {
        if (!cancelled) setResolvedManifestUrl(buildManifestUrl(firstManifest))
      }
    }

    void loadResolvedManifest()

    return () => {
      cancelled = true
    }
  }, [firstManifest])

  // 监听全屏状态变化
  useEffect(() => {
    function handleFullscreenChange(): void {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // 全屏切换处理
  const handleToggleFullscreen = (): void => {
    const wrapper = viewerWrapperRef.current
    if (!wrapper) return

    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void wrapper.requestFullscreen()
    }
  }

  useEffect(() => {
    if (!embedded || !showVolumeHeadNavigator || !hasManifests || !effectiveManifestUrl) {
      setVolumeHeads([])
      setIsLoadingVolumeHeads(false)
      return
    }

    let cancelled = false

    async function loadVolumeHeads(): Promise<void> {
      setIsLoadingVolumeHeads(true)
      try {
        const params = new globalThis.URLSearchParams({ manifest: effectiveManifestUrl })
        const response = await globalThis.fetch(`/api/v1/iiif/volume-heads?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`volume-heads request failed: ${response.status}`)
        }
        const payload = await response.json() as IiifVolumeHeadsApiResponse
        const heads = _normalizeVolumeHeads(payload?.data?.volumeHeads)
        if (!cancelled) setVolumeHeads(heads)
      } catch {
        if (!cancelled) setVolumeHeads([])
      } finally {
        if (!cancelled) setIsLoadingVolumeHeads(false)
      }
    }

    void loadVolumeHeads()

    return () => {
      cancelled = true
    }
  }, [embedded, showVolumeHeadNavigator, hasManifests, effectiveManifestUrl])

  if (!hasManifests) {
    return null
  }

  if (embedded) {
    return (
      <div style={SECTION_STYLE}>
        {!hideTitle && <h3 style={SECTION_TITLE_STYLE}>{DEFAULT_PREVIEW_LABEL}</h3>}
        {showVolumeHeadNavigator ? (
          <div style={VOLUME_HEAD_NAV_STYLE}>
            <div className="muted" style={VOLUME_HEAD_TITLE_STYLE}>{DEFAULT_VOLUME_HEAD_NAV_LABEL}</div>
            {isLoadingVolumeHeads ? (
              <p className="muted">{DEFAULT_VOLUME_HEAD_LOADING_LABEL}</p>
            ) : (
              _renderVolumeHeadButtons(
                volumeHeads,
                selectedCanvasId,
                (canvasId) => {
                  setSelectedCanvasId(canvasId)
                  if (!shouldShowViewer) setShowViewer(true)
                },
              )
            )}
          </div>
        ) : null}
        {shouldShowViewer && effectiveManifestUrl ? (
          <div ref={viewerWrapperRef} style={VIEWER_WRAPPER_STYLE}>
            <iframe
              title="Mirador 图像查看器"
              src={iframeSrc}
              style={{ ...IFRAME_STYLE, height }}
              allow="fullscreen"
              allowFullScreen
            />
            <button
              onClick={handleToggleFullscreen}
              style={{ ...FULLSCREEN_BUTTON_STYLE, marginTop: '8px' }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <>
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </>
                ) : (
                  <>
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </>
                )}
              </svg>
              {isFullscreen ? DEFAULT_EXIT_FULLSCREEN_LABEL : DEFAULT_FULLSCREEN_LABEL}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowViewer(true)}
            style={LOAD_BUTTON_STYLE}
          >
            <span>{DEFAULT_EMBEDDED_BUTTON_LABEL}</span>
          </button>
        )}
        {!hidePopupLink && (
          <div style={POPUP_LINK_WRAPPER_STYLE}>
            <IIIFLink manifestUrl={effectiveManifestUrl || firstManifest} label={DEFAULT_POPUP_LABEL} />
          </div>
        )}
        {_renderManifestCount(manifests.length)}
      </div>
    )
  }

  return (
    <div style={SECTION_STYLE}>
      <h3 style={SECTION_TITLE_STYLE}>{DEFAULT_RESOURCE_LABEL}</h3>
      <IIIFLink manifestUrl={effectiveManifestUrl || firstManifest} />
      {_renderManifestCount(manifests.length)}
    </div>
  )
}

function _buildMiradorUrl(manifestPath: string, canvasId = ''): string {
  const fullUrl = buildManifestUrl(manifestPath)
  return buildMiradorViewerUrl(fullUrl, canvasId)
}

function _buildAbsoluteMiradorUrl(manifestPath: string, canvasId = ''): string {
  const miradorUrl = _buildMiradorUrl(manifestPath, canvasId)
  if (!miradorUrl) return ''
  if (/^https?:\/\//i.test(miradorUrl)) return miradorUrl
  if (typeof window === 'undefined' || !window.location?.origin) return miradorUrl
  return new URL(miradorUrl, window.location.origin).toString()
}

function _renderManifestCount(count: number): JSX.Element | null {
  if (count <= 1) return null
  return (
    <p className="muted" style={MANIFEST_COUNT_STYLE}>
      共 {count} 个图像可用
    </p>
  )
}

function _normalizeVolumeHeads(raw: unknown): IiifVolumeHead[] {
  const items = Array.isArray(raw) ? raw : []
  const output: IiifVolumeHead[] = []
  const seen = new Set<string>()

  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const volumeLabel = String(row.volumeLabel || '').trim()
    const canvasId = String(row.canvasId || '').trim()
    if (!volumeLabel || !canvasId) continue
    if (seen.has(volumeLabel)) continue
    seen.add(volumeLabel)
    output.push({
      volumeLabel,
      canvasId,
      canvasLabel: String(row.canvasLabel || '').trim() || undefined,
      pageIndex: Number.isFinite(Number(row.pageIndex)) ? Number(row.pageIndex) : undefined,
    })
  }

  return output
}

function _renderVolumeHeadButtons(
  volumeHeads: IiifVolumeHead[],
  selectedCanvasId: string,
  onSelect: (canvasId: string) => void,
): JSX.Element | null {
  if (!volumeHeads.length) return null
  return (
    <div style={VOLUME_HEAD_LIST_STYLE}>
      {volumeHeads.map((item) => (
        <button
          key={`${item.volumeLabel}-${item.canvasId}`}
          type="button"
          title={item.canvasLabel || `跳转到${item.volumeLabel}`}
          onClick={() => onSelect(item.canvasId)}
          style={item.canvasId === selectedCanvasId
            ? { ...VOLUME_HEAD_BUTTON_STYLE, ...VOLUME_HEAD_BUTTON_ACTIVE_STYLE }
            : VOLUME_HEAD_BUTTON_STYLE}
        >
          {item.volumeLabel}
        </button>
      ))}
    </div>
  )
}
