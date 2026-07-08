import { useEffect, useMemo, useRef, useState } from 'react'
import { asArray, asRecord, normalizeText, pickNodeText } from './utils'
import { loadMapJsApi } from '@/features/details/components/PersonPoemTrackMap/services'
import '@/types/map.global' // 导入全局声明

const MAP_DETAIL_ZOOM = 13
const MAP_MULTI_POINT_ZOOM = 10

interface PlaceCoordinateMapPanelProps {
  entity: Record<string, unknown>
}

interface PlacePoint {
  label: string
  lat: number
  lng: number
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

function extractPlacePoints(entity: Record<string, unknown>): PlacePoint[] {
  const points: PlacePoint[] = []
  const dedupe = new Set<string>()

  const mainPoint = parseWktPoint(entity.defined_by || entity['crm:P168_place_is_defined_by'])
  if (mainPoint) {
    const mainLabel = pickNodeText(entity._label || entity) || '地点坐标'
    const key = `${mainLabel}:${mainPoint.lng}:${mainPoint.lat}`
    dedupe.add(key)
    points.push({ label: mainLabel, lat: mainPoint.lat, lng: mainPoint.lng })
  }

  const currentLocations = asArray(entity.current_location).map((item) => asRecord(item))
  currentLocations.forEach((location, index) => {
    const point = parseWktPoint(location.defined_by || location['crm:P168_place_is_defined_by'])
    if (!point) return
    const label = pickNodeText(location._label || location) || `地点坐标 ${index + 1}`
    const key = `${label}:${point.lng}:${point.lat}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    points.push({ label, lat: point.lat, lng: point.lng })
  })

  return points
}

export function PlaceCoordinateMapPanel({ entity }: PlaceCoordinateMapPanelProps): JSX.Element | null {
  const points = useMemo(() => extractPlacePoints(entity), [entity])
  const pointsKey = useMemo(() => points.map((p) => `${p.label}:${p.lng}:${p.lat}`).join('|'), [points])
  const pointsRef = useRef(points)
  pointsRef.current = points
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null) // 地图实例
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
    <section className="yale-overview-tab__section yale-place-card yale-place-card--map">
      <h3 className="yale-place-detail__title">地理坐标与地图</h3>
      <div ref={mapContainerRef} className="yale-place-detail__map-canvas" />
      {status === 'loading' && <p className="yale-place-detail__meta">正在加载地图...</p>}
      {status === 'error' && <p className="yale-place-detail__meta yale-place-detail__meta--error">地图加载失败，请检查网络或资源配置。</p>}
    </section>
  )
}
