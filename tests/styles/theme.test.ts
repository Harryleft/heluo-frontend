/**
 * 主题配置使用示例
 * 验证主题可以被正确导入和使用
 */

import theme from '../../src/styles/theme'

// 测试主题导出
console.log('Theme import test:', {
  colors: Object.keys(theme.color),
  fonts: Object.keys(theme.font),
  spacing: Object.keys(theme.spacing),
  breakpoints: theme.breakpoints,
  border: theme.border,
})

// 示例：使用主题中的颜色
const primaryBlue = theme.color.primary.blue
const errorColor = theme.color.errorFg

// 示例：使用主题中的字体配置
const h1Size = theme.font.desktop.h1.size
const bodyWeight = theme.font.desktop.bodyRegular.weight

// 示例：使用主题中的间距
const sectionGap = theme.spacing.sectionGap

// 示例：使用主题中的断点
const tabletBreakpoint = theme.breakpoints.md

export {
  primaryBlue,
  errorColor,
  h1Size,
  bodyWeight,
  sectionGap,
  tabletBreakpoint,
}
