/**
 * 标记点构建服务
 *
 * 负责创建地图标记点
 */

import type { PoemTrackPoint } from '@/types/contracts/poemTrackContracts'
import { createMarkerContent } from '@/features/details/components/PersonPoemTrackMap/styles/markerStyles'

/**
 * 获取轨迹点的唯一标识
 *
 * @param point - 轨迹点
 * @returns 唯一标识字符串
 */
export function getTrackPointKey(point: Pick<PoemTrackPoint, 'year' | 'place'>): string {
  return `${point.year}::${point.place.uri}`
}

/**
 * 创建地图标记点
 *
 * 采用累积显示模式：只显示当前年份及之前的轨迹点
 *
 * @param MapApi - 地图 API
 * @param map - 地图实例
 * @param trackPoints - 轨迹点数组
 * @param yearRange - 年份范围
 * @param currentYear - 当前选中年份
 * @param selectedTrackKey - 当前选中轨迹点标识
 * @param onMarkerClick - 标记点点击回调
 * @param markersRef - 标记点引用数组（用于清理）
 */
export function createMarkers(
  MapApi: any,
  map: any,
  trackPoints: PoemTrackPoint[],
  yearRange: { start: number; end: number },
  currentYear: number | null,
  selectedTrackKey: string | null,
  onMarkerClick: (year: number, trackKey: string) => void,
  markersRef: any[],
): void {
  // 清理旧标记
  markersRef.forEach((marker) => marker.setMap(null))
  markersRef.length = 0

  // 累积过滤：只显示当前年份及之前的轨迹点
  const accumulatedPoints = currentYear
    ? trackPoints.filter((point) => point.year <= currentYear)
    : trackPoints

  // 创建新标记
  accumulatedPoints.forEach((point) => {
    const trackKey = getTrackPointKey(point)
    const isCurrent = selectedTrackKey === trackKey
    const contentHtml = createMarkerContent(point.poems.length, point.year, yearRange, isCurrent)

    const marker = new MapApi.Marker({
      map,
      position: [point.place.lng, point.place.lat],
      content: contentHtml,
      title: `${point.place.label} (${point.yearLabel}) - ${point.poems.length}首诗`,
    })

    // 点击事件
    const markerContent = marker.getContent() as HTMLElement
    if (markerContent && typeof markerContent.addEventListener === 'function') {
      const clickHandler = () => {
        onMarkerClick(point.year, trackKey)
      }
      markerContent.addEventListener('click', clickHandler)
    }

    markersRef.push(marker)
  })
}
