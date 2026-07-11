/**
 * 轨迹工具函数
 *
 * 提供轨迹点坐标提取、年份范围计算等工具函数
 */

import type { PoemTrackPoint, PersonPoemTrack } from '@/types/contracts/poemTrackContracts'

export interface TrackPlaceGroup {
  points: PoemTrackPoint[]
  representative: PoemTrackPoint
  poemCount: number
  startYear: number
  endYear: number
}

function compareTrackPoints(a: PoemTrackPoint, b: PoemTrackPoint): number {
  if (a.year !== b.year) return a.year - b.year
  return a.place.uri.localeCompare(b.place.uri)
}

/**
 * 时间轴未初始化时只显示最早年份，避免短暂绘制完整生涯数据。
 */
export function getVisibleTrackPoints(
  trackPoints: PoemTrackPoint[],
  currentYear: number | null,
): PoemTrackPoint[] {
  if (trackPoints.length === 0) return []
  const sorted = [...trackPoints].sort(compareTrackPoints)
  const cutoffYear = currentYear ?? sorted[0].year
  return sorted.filter((point) => point.year <= cutoffYear)
}

/**
 * 同一年缺少地点先后顺序时，以作品最多的地点代表该年，避免制造虚假的往返路线。
 */
export function buildTrackPath(
  trackPoints: PoemTrackPoint[],
  currentYear: number | null,
): Array<{ lng: number; lat: number }> {
  const representatives = new Map<number, PoemTrackPoint>()
  for (const point of getVisibleTrackPoints(trackPoints, currentYear)) {
    const current = representatives.get(point.year)
    if (!current || point.poems.length > current.poems.length) {
      representatives.set(point.year, point)
    }
  }

  const path: Array<{ lng: number; lat: number }> = []
  for (const point of representatives.values()) {
    const coordinate = { lng: point.place.lng, lat: point.place.lat }
    const previous = path[path.length - 1]
    if (previous && previous.lng === coordinate.lng && previous.lat === coordinate.lat) continue
    path.push(coordinate)
  }
  return path
}

/** 合并同一地点的历年标记，数字表示当前时间点之前的累计诗文数量。 */
export function groupVisibleTrackPointsByPlace(
  trackPoints: PoemTrackPoint[],
  currentYear: number | null,
): TrackPlaceGroup[] {
  const groups = new Map<string, PoemTrackPoint[]>()
  for (const point of getVisibleTrackPoints(trackPoints, currentYear)) {
    const existing = groups.get(point.place.uri)
    if (existing) existing.push(point)
    else groups.set(point.place.uri, [point])
  }

  return Array.from(groups.values()).map((points) => {
    const representative = points[points.length - 1]
    return {
      points,
      representative,
      poemCount: points.reduce((sum, point) => sum + point.poems.length, 0),
      startYear: points[0].year,
      endYear: representative.year,
    }
  })
}

/**
 * 提取轨迹点坐标数组
 *
 * @param trackPoints - 轨迹点数组
 * @returns 坐标数组
 */
export function extractTrackPoints(
  trackPoints: PoemTrackPoint[],
): Array<{ lng: number; lat: number }> {
  return trackPoints.map((point) => ({
    lng: point.place.lng,
    lat: point.place.lat,
  }))
}

/**
 * 获取年份范围
 *
 * @param trackData - 轨迹数据
 * @param availableYears - 可用年份列表
 * @returns 年份范围
 */
export function getYearRange(
  trackData: PersonPoemTrack | null,
  availableYears: number[],
): { start: number; end: number } {
  if (trackData?.stats.yearRange) {
    return trackData.stats.yearRange
  }
  if (availableYears.length > 0) {
    return {
      start: availableYears[0],
      end: availableYears[availableYears.length - 1],
    }
  }
  return { start: 0, end: 0 }
}
