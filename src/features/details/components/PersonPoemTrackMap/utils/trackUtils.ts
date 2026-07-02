/**
 * 轨迹工具函数
 *
 * 提供轨迹点坐标提取、年份范围计算等工具函数
 */

import type { PoemTrackPoint, PersonPoemTrack } from '@/types/contracts/poemTrackContracts'

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
