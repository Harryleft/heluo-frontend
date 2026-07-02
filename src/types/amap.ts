/**
 * 高德地图类型定义
 *
 * 统一的高德地图 JS API 2.0 类型定义，供多个组件共享
 */

// ============================================================================
// 高德地图类型
// ============================================================================

/**
 * 高德地图实例接口
 */
export interface AMapMapInstance {
  setFitView(): void
  destroy(): void
  setCenter(center: [number, number]): void
  setZoom(zoom: number): void
  getBounds(): { getSouthWest(): { lng: number; lat: number }; getNorthEast(): { lng: number; lat: number } }
  addControl(control: unknown): void
}

/**
 * 高德地图 Marker 接口
 */
export interface AMapMarker {
  setMap(map: AMapMapInstance | null): void
  setPosition(position: [number, number]): void
  getContent(): HTMLElement | string
  setContent(content: HTMLElement | string): void
}

/**
 * 高德地图 Polyline 接口
 */
export interface AMapPolyline {
  setMap(map: AMapMapInstance | null): void
}
