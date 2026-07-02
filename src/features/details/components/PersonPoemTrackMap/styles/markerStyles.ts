/**
 * 标记点样式模块
 *
 * 包含标记点基础样式、水墨晕染动画、标记点创建函数
 */

import { calculateInkColor } from './inkColors'

/** 历史标记点基础样式 */
export const MARKER_BASE_STYLE = `
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: bold;
  color: #fff;
  cursor: pointer;
  transition: transform 0.3s ease;
  position: relative;
`

/** 水墨晕染动画样式（注入到页面） */
export const INK_HALO_ANIMATION = `
@keyframes ink-halo-breathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.5;
  }
}
@keyframes ink-halo-pulse {
  0%, 100% {
    transform: scale(1.1);
    opacity: 0.2;
  }
  50% {
    transform: scale(1.25);
    opacity: 0.35;
  }
}
`

/**
 * 创建水墨晕染效果的当前选中点
 *
 * @param inkColor - 墨色
 * @param number - 显示的数字
 * @returns HTML字符串
 */
export function createInkHaloMarker(inkColor: string, number: number): string {
  return `
    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
      <!-- 第三层晕染（最外层） -->
      <div style="
        position: absolute;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${inkColor};
        opacity: 0.08;
        animation: ink-halo-pulse 2.5s ease-in-out infinite;
      "></div>
      <!-- 第二层晕染 -->
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${inkColor};
        opacity: 0.15;
        animation: ink-halo-breathe 2s ease-in-out infinite;
      "></div>
      <!-- 中心墨点 -->
      <div style="
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0 8px;
        border-radius: 50%;
        background: ${inkColor};
        font-size: 12px;
        font-weight: bold;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      ">${number}</div>
    </div>
  `
}

/**
 * 创建 Marker 内容元素
 *
 * 使用水墨晕染风格：
 * - 历史点：单色墨点
 * - 当前选中点：墨点 + 多层晕染 + 呼吸动画
 *
 * @param number - 标记点显示的数字（诗文数量）
 * @param year - 该点的年份
 * @param yearRange - 年份范围
 * @param isCurrent - 是否为当前选中的点
 */
export function createMarkerContent(
  number: number,
  year: number,
  yearRange: { start: number; end: number },
  isCurrent: boolean,
): string {
  // 计算墨色
  const inkColor = calculateInkColor(year, yearRange)

  // 当前选中点：水墨晕染效果
  if (isCurrent) {
    // 确保动画样式已注入
    if (typeof document !== 'undefined' && !document.getElementById('ink-halo-animation')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'ink-halo-animation'
      styleEl.textContent = INK_HALO_ANIMATION
      document.head.appendChild(styleEl)
    }
    return createInkHaloMarker(inkColor, number)
  }

  // 历史点：简洁墨点
  return `<div style="${MARKER_BASE_STYLE}background: ${inkColor};">${number}</div>`
}
