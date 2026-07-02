/**
 * 高德地图全局类型声明
 *
 * 统一声明 window._AMapSecurityConfig 全局变量
 * 注意：window.AMap 在各组件文件中分别声明以避免类型冲突
 */

declare global {
  interface Window {
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}

// 空导出，使文件成为模块
export {}


