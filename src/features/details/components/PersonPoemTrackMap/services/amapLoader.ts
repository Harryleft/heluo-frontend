/**
 * 地图加载服务（最小替换实现）
 *
 * 统一通过 loadAmapJsApi 接口返回地图命名空间：
 * - 默认使用 Leaflet（开源、无需 Key）
 * - 兼容 REACT_MAP_PROVIDER=amap 时退回高德
 */

import {
  AMAP_JS_API_URL,
  AMAP_JS_API_VERSION,
  AMAP_KEY,
  AMAP_SCRIPT_ID,
  AMAP_SECURITY_JS_CODE,
  LEAFLET_CSS_ID,
  LEAFLET_CSS_URL,
  LEAFLET_JS_URL,
  LEAFLET_MAP_ATTRIBUTION,
  LEAFLET_SCRIPT_ID,
  LEAFLET_TILE_URL,
  MAP_PROVIDER,
} from '@/features/details/components/PersonPoemTrackMap/constants'

type MapProvider = 'leaflet' | 'amap'

type MapPoint = [number, number]
type MapBounds = { getSouthWest(): { lng: number; lat: number }; getNorthEast(): { lng: number; lat: number } }
type MapInstance = { setFitView(): void; destroy(): void; setCenter: (center: MapPoint) => void; setZoom: (zoom: number) => void; getZoom: () => number; getBounds: () => MapBounds; addControl: (control: unknown) => void; panTo: (center: MapPoint, _opts?: unknown, duration?: number) => void }

type MapNamespace = {
  Map: new (container: HTMLElement, options?: Record<string, any>) => MapInstance
  Marker: new (options: Record<string, any>) => {
    setMap: (map: MapInstance | null) => void
    setPosition: (position: MapPoint) => void
    getContent: () => HTMLElement | string
    setContent: (content: string) => void
  }
  Polyline: new (options: Record<string, any>) => {
    setMap: (map: MapInstance | null) => void
  }
}

type MaybeWindow = Window & {
  AMap?: MapNamespace
  L?: Record<string, unknown> & { map: any; marker: any; polyline: any; tileLayer: any; divIcon: any; latLngBounds: any; latLng: any }
  _AMapSecurityConfig?: { securityJsCode: string }
}

interface MapLoadState {
  provider: MapProvider
  promise: Promise<MapNamespace>
}

let mapLoadState: MapLoadState | null = null

function normalizePoint(point: unknown, fallback: MapPoint = [116.4, 39.9]): MapPoint {
  if (!Array.isArray(point) || point.length < 2) {
    return fallback
  }

  const lng = Number(point[0])
  const lat = Number(point[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return fallback
  }
  return [lng, lat]
}

function toLeafletLatLng(point: MapPoint): [number, number] {
  return [point[1], point[0]]
}

function ensureSingleScript(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (!existing) {
      const script = document.createElement('script')
      script.id = id
      script.src = src
      script.async = true
      script.defer = true
      script.onload = () => {
        script.dataset.loaded = '1'
        resolve()
      }
      script.onerror = () => reject(new Error(`地图脚本加载失败: ${src}`))
      document.head.appendChild(script)
      return
    }

    if (existing.dataset.loaded === '1') {
      resolve()
      return
    }

    existing.addEventListener('load', () => resolve(), { once: true })
    existing.addEventListener('error', () => reject(new Error(`地图脚本加载失败: ${src}`)), { once: true })
  })
}

function ensureSingleLink(id: string, href: string): void {
  if (document.getElementById(id)) {
    return
  }

  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function createMapTileUrl(): string {
  return LEAFLET_TILE_URL
}

function createLeafletAmapNamespace(): Promise<MapNamespace> {
  const win = window as MaybeWindow

  if (win.AMap && (win.AMap as any).__mapProvider === 'leaflet') {
    return Promise.resolve(win.AMap)
  }

  const load = async (): Promise<MapNamespace> => {
    ensureSingleLink(LEAFLET_CSS_ID, LEAFLET_CSS_URL)
    await ensureSingleScript(LEAFLET_SCRIPT_ID, LEAFLET_JS_URL)

    if (!win.L || typeof win.L.map !== 'function' || typeof win.L.marker !== 'function') {
      throw new Error('Leaflet 资源加载成功，但全局对象 L 未就绪。')
    }

    const Leaflet = win.L as any

    class LeafletMap {
      private map: any
      private layers = new Set<any>()

      constructor(container: HTMLElement, options: Record<string, any> = {}) {
        const center = normalizePoint(options.center, [116.4, 39.9])
        const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : 10
        this.map = Leaflet.map(container, {
          center: toLeafletLatLng(center),
          zoom,
          zoomControl: true,
        })
        Leaflet.tileLayer(createMapTileUrl(), {
          attribution: LEAFLET_MAP_ATTRIBUTION,
        }).addTo(this.map)
      }

      setFitView(): void {
        let bounds = Leaflet.latLngBounds([])
        this.layers.forEach((layer) => {
          if (layer?.getBounds) {
            const layerBounds = layer.getBounds()
            if (layerBounds?.isValid?.()) {
              bounds.extend(layerBounds.getSouthWest())
              bounds.extend(layerBounds.getNorthEast())
            }
            return
          }
          if (layer?.getLatLng) {
            bounds.extend(layer.getLatLng())
          }
        })

        if (bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [20, 20] })
          return
        }
        const center = this.map.getCenter()
        this.map.setView(center, this.map.getZoom(), { animate: false })
      }

      destroy(): void {
        if (!this.map) return
        this.map.off()
        this.layers.clear()
        this.map.remove()
      }

      getNativeMap(): any {
        return this.map
      }

      _attachLayer(layer: any): void {
        if (layer) this.layers.add(layer)
      }

      _detachLayer(layer: any): void {
        if (layer) this.layers.delete(layer)
      }

      setCenter(center: MapPoint): void {
        this.map.setView(toLeafletLatLng(center))
      }

      setZoom(zoom: number): void {
        this.map.setZoom(zoom)
      }

      getZoom(): number {
        return this.map.getZoom()
      }

      getBounds(): MapBounds {
        const bounds = this.map.getBounds()
        return {
          getSouthWest: () => {
            const sw = bounds.getSouthWest()
            return { lng: sw.lng, lat: sw.lat }
          },
          getNorthEast: () => {
            const ne = bounds.getNorthEast()
            return { lng: ne.lng, lat: ne.lat }
          },
        }
      }

      addControl(control: unknown): void {
        if (!control || !this.map) return
        if (typeof control === 'object' && typeof (control as { addTo: Function }).addTo === 'function') {
          (control as { addTo: (map: any) => void }).addTo(this.map)
          return
        }
      }

      panTo(center: MapPoint, _opts?: unknown, duration?: number): void {
        const durationSec = Number.isFinite(duration || 0) ? duration! / 1000 : 0.5
        this.map.flyTo(toLeafletLatLng(center), this.map.getZoom(), {
          animate: true,
          duration: durationSec,
        })
      }
    }

    const createDivIcon = (content: string) =>
      Leaflet.divIcon({
        html: `<div style="pointer-events:auto;">${content}</div>`,
        className: 'heluo-map-marker-wrapper',
        iconSize: [64, 64],
        iconAnchor: [32, 64],
      })

    class LeafletMarker {
      private marker: any
      private mapRef: LeafletMap | null = null

      constructor(options: Record<string, any>) {
        const position = normalizePoint(options.position, [116.4, 39.9])
        const content = String(options.content || '')
        const title = String(options.title || '')

        this.marker = Leaflet.marker(toLeafletLatLng(position), {
          icon: createDivIcon(content),
          title,
        })
        if (options.map) {
          this.setMap(options.map)
        }
      }

      setMap(map: LeafletMap | null): void {
        if (this.mapRef) {
          this.mapRef._detachLayer(this.marker)
          this.marker.remove()
        }
        this.mapRef = map
        if (!map) return
        this.marker.addTo(map.getNativeMap())
        map._attachLayer(this.marker)
      }

      setPosition(position: MapPoint): void {
        this.marker.setLatLng(toLeafletLatLng(position))
      }

      getContent(): HTMLElement | string {
        return (this.marker.getElement() as HTMLElement | null) || ''
      }

      setContent(content: string): void {
        this.marker.setIcon(createDivIcon(content))
      }
    }

    class LeafletPolyline {
      private polyline: any
      private mapRef: LeafletMap | null = null

      constructor(options: Record<string, any>) {
        const path = Array.isArray(options.path) ? options.path : []
        const style: Record<string, unknown> = {
          color: options.strokeColor || '#4a4a4a',
          weight: Number.isFinite(Number(options.borderWeight)) ? Number(options.borderWeight) : 2,
          lineJoin: options.lineJoin || 'round',
        }
        this.polyline = Leaflet.polyline(path.map((point: unknown) => toLeafletLatLng(normalizePoint(point))), style)
        if (options.map) {
          this.setMap(options.map)
        }
      }

      setMap(map: LeafletMap | null): void {
        if (this.mapRef) {
          this.mapRef._detachLayer(this.polyline)
          this.polyline.remove()
        }
        this.mapRef = map
        if (!map) return
        this.polyline.addTo(map.getNativeMap())
        map._attachLayer(this.polyline)
      }
    }

    const namespace: MapNamespace = {
      Map: LeafletMap as any,
      Marker: LeafletMarker as any,
      Polyline: LeafletPolyline as any,
    }

    const expose: MapNamespace = namespace
    ;(win as MaybeWindow).AMap = expose
    if ((win as MaybeWindow).AMap) {
      ;((win as MaybeWindow).AMap as any).__mapProvider = 'leaflet'
    }
    return expose
  }

  return load()
}

function buildAmapJsApiUrl(): string {
  const params = new globalThis.URLSearchParams({
    v: AMAP_JS_API_VERSION,
    key: AMAP_KEY,
  })
  return `${AMAP_JS_API_URL}?${params.toString()}`
}

function loadAmapJsApiFromVendor(): Promise<MapNamespace> {
  const win = window as MaybeWindow

  if (win.AMap && (win.AMap as any).__mapProvider === 'amap') {
    return Promise.resolve(win.AMap)
  }

  return new Promise<MapNamespace>((resolve, reject) => {
    if (!AMAP_KEY || !AMAP_SECURITY_JS_CODE) {
      reject(new Error('缺少高德地图 Key 或安全密钥配置。'))
      return
    }

    win._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY_JS_CODE,
    }

    const finishResolve = (): void => {
      const winAmap = win.AMap
      if (winAmap) {
        ;(winAmap as any).__mapProvider = 'amap'
        resolve(winAmap)
        return
      }
      reject(new Error('高德地图 JS API 加载成功但 AMap 对象不可用。'))
    }

    const handleError = (): void => {
      reject(new Error('高德地图 JS API 加载失败，请检查网络或 Key 配置。'))
    }

    const existing = document.getElementById(AMAP_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', finishResolve, { once: true })
      existing.addEventListener('error', handleError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = AMAP_SCRIPT_ID
    script.src = buildAmapJsApiUrl()
    script.async = true
    script.defer = true
    script.onload = finishResolve
    script.onerror = handleError
    document.head.appendChild(script)
  })
}

function resolveProvider(): MapProvider {
  return MAP_PROVIDER === 'amap' ? 'amap' : 'leaflet'
}

/**
 * 加载地图 JS API（兼容高德与 Leaflet）
 *
 * 默认返回 Leaflet 兼容命名空间，避免业务层改动。
 */
export function loadAmapJsApi(): Promise<MapNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('当前环境不支持地图加载。'))
  }

  const targetProvider = resolveProvider()

  if (mapLoadState && mapLoadState.provider === targetProvider) {
    return mapLoadState.promise
  }

  const load = targetProvider === 'amap' ? loadAmapJsApiFromVendor() : createLeafletAmapNamespace()

  mapLoadState = {
    provider: targetProvider,
    promise: load.catch((error) => {
      mapLoadState = null
      throw error
    }),
  }

  return mapLoadState.promise
}
