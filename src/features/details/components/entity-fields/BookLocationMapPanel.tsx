import { useEffect, useMemo, useRef, useState } from 'react'
import { asArray, asRecord, normalizeText, pickNodeText } from './utils'
import { loadMapJsApi } from '@/features/details/components/PersonPoemTrackMap/services'
import '@/types/map.global'

const MAP_DETAIL_ZOOM = 15
const MAP_MULTI_POINT_ZOOM = 11

interface BookLocationMapPanelProps {
  entity: Record<string, unknown>
}

interface MapPoint {
  label: string
  lat: number
  lng: number
}

interface MapInstance {
  setFitView(): void
  destroy(): void
}

function parseWktPoint(value: unknown): { lat: number; lng: number } | null {
  const raw = normalizeText(value)
  if (!raw || !raw.includes('POINT')) return null
  const match = raw.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
  if (!match) return null
  const lng = Number.parseFloat(match[1] || '')
  const lat = Number.parseFloat(match[2] || '')
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function extractBookLocationPoints(entity: Record<string, unknown>): MapPoint[] {
  const locations = asArray(entity.current_location).map((item) => asRecord(item))
  const dedupe = new Set<string>()
  const points: MapPoint[] = []

  locations.forEach((location, index) => {
    const point = parseWktPoint(location.defined_by || location['crm:P168_place_is_defined_by'])
    if (!point) return
    const label = pickNodeText(location._label || location.label || location) || `馆藏位置 ${index + 1}`
    const key = `${label}:${point.lng}:${point.lat}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    points.push({ label, lat: point.lat, lng: point.lng })
  })

  return points
}

export function BookLocationMapPanel({ entity }: BookLocationMapPanelProps): JSX.Element | null {
  const points = useMemo(() => extractBookLocationPoints(entity), [entity])
  const pointsKey = useMemo(() => points.map((p) => `${p.label}:${p.lng}:${p.lat}`).join('|'), [points])
  const pointsRef = useRef(points)
  pointsRef.current = points
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const nextPoints = pointsRef.current
    if (!nextPoints.length || !mapContainerRef.current) return

    let active = true
    setStatus('loading')

    loadMapJsApi()
      .then((MapApi) => {
        if (!active || !mapContainerRef.current) return
        const center: [number, number] = [nextPoints[0].lng, nextPoints[0].lat]
        const map = new MapApi.Map(mapContainerRef.current, {
          center,
          zoom: nextPoints.length > 1 ? MAP_MULTI_POINT_ZOOM : MAP_DETAIL_ZOOM,
          viewMode: '2D',
        })
        nextPoints.forEach((point) => {
          new MapApi.Marker({
            map,
            position: [point.lng, point.lat],
            title: point.label,
          })
        })
        if (nextPoints.length > 1) {
          map.setFitView()
        }
        mapRef.current = map
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setStatus('error')
      })

    return () => {
      active = false
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [pointsKey])

  if (!points.length) return null

  return (
    <section className="yale-overview-tab__section yale-overview-tab__section--type yale-overview-tab__section--map">
      <h3 className="yale-overview-tab__type-title">馆藏地址</h3>
      <div ref={mapContainerRef} className="yale-overview-tab__map-canvas" />
      {status === 'loading' && <p className="yale-overview-tab__map-status">正在加载地图...</p>}
      {status === 'error' && <p className="yale-overview-tab__map-status yale-overview-tab__map-status--error">地图加载失败，请检查网络或资源配置。</p>}
    </section>
  )
}
