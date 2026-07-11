/**
 * 墨色渐变配色常量
 *
 * 用于轨迹地图的标记点和连线颜色，营造水墨画风格
 */

/** 墨色渐变色谱 */
export const INK_COLORS = {
  /** 早期 - 深墨 */
  dark: '#1a1a1a',
  /** 晚期 - 浅灰 */
  light: '#7a7a7a',
  /** 朱砂红 - 当前强调边框 */
  vermilion: '#a43b32',
  /** 轨迹线颜色 */
  line: '#514a42',
} as const

/**
 * 根据年份在时间跨度中的位置计算墨色
 *
 * @param year - 当前年份
 * @param yearRange - 年份范围 { start, end }
 * @returns 墨色十六进制值 (如 "#3a3a3a")
 */
export function calculateInkColor(
  year: number,
  yearRange: { start: number; end: number },
): string {
  const { start, end } = yearRange
  if (end === start) return INK_COLORS.dark

  const progress = (year - start) / (end - start)
  const clampedProgress = Math.max(0, Math.min(1, progress))

  // 从深墨 #1a1a1a (26) 渐变到浅灰 #7a7a7a (122)
  const darkGray = 26 // 0x1a
  const lightGray = 122 // 0x7a
  const gray = Math.round(darkGray + clampedProgress * (lightGray - darkGray))

  const hex = gray.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}
