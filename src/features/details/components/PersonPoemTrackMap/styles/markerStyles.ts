/**
 * 标记点样式模块
 *
 * 包含标记点基础样式、水墨晕染动画、标记点创建函数
 */

import { calculateInkColor, INK_COLORS } from './inkColors'

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
  border: 1px solid rgba(247, 239, 220, 0.92);
  box-shadow: 0 2px 5px rgba(36, 31, 25, 0.26), 0 0 0 1px rgba(38, 34, 29, 0.16);
  font-family: "Noto Serif SC", "Songti SC", serif;
  letter-spacing: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
`

/** 水墨晕染动画样式（注入到页面） */
export const INK_HALO_ANIMATION = `
@keyframes ink-halo-breathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.22;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.34;
  }
}
@keyframes ink-halo-pulse {
  0%, 100% {
    transform: scale(1.05);
    opacity: 0.14;
  }
  50% {
    transform: scale(1.16);
    opacity: 0.24;
  }
}
@media (prefers-reduced-motion: reduce) {
  .poem-track-marker-halo {
    animation: none !important;
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
    <div class="poem-track-marker poem-track-marker--current" style="position: relative; display: flex; align-items: center; justify-content: center;">
      <!-- 第三层晕染（最外层） -->
      <div class="poem-track-marker-halo" style="
        position: absolute;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${inkColor};
        opacity: 0.08;
        animation: ink-halo-pulse 2.5s ease-in-out infinite;
      "></div>
      <!-- 第二层晕染 -->
      <div class="poem-track-marker-halo" style="
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
        font-family: &quot;Noto Serif SC&quot;, &quot;Songti SC&quot;, serif;
        letter-spacing: 0;
        color: #fff;
        cursor: pointer;
        border: 1px solid rgba(255, 241, 211, 0.92);
        box-shadow: 0 2px 8px rgba(74, 28, 23, 0.32), 0 0 0 1px rgba(93, 31, 26, 0.2);
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
    return createInkHaloMarker(INK_COLORS.vermilion, number)
  }

  // 历史点：简洁墨点
  return `<div class="poem-track-marker poem-track-marker--historical" style="${MARKER_BASE_STYLE}background: ${inkColor};">${number}</div>`
}
