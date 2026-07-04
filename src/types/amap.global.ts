/**
 * 地图全局类型声明
 *
 * 统一声明 window 侧的地图运行时对象，兼容高德与 Leaflet shim
 */

declare global {
  interface Window {
    AMap?: Record<string, unknown> & {
      __mapProvider?: 'leaflet' | 'amap'
    }
    L?: Record<string, unknown>
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}

// 空导出，使文件成为模块
export {}

