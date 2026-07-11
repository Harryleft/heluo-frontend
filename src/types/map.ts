/**
 * 地图对象类型定义
 */

export type MapPoint = [lng: number, lat: number]

export interface MapBounds {
  getSouthWest(): { lng: number; lat: number }
  getNorthEast(): { lng: number; lat: number }
}

export interface MapInstance {
  setFitView(): void
  destroy(): void
  setCenter(center: MapPoint): void
  setZoom(zoom: number): void
  getZoom(): number
  getBounds(): MapBounds
  getNativeMap?(): unknown
  panTo(center: MapPoint, options?: unknown, duration?: number): void
  addControl(control: unknown): void
}

export interface MapMarker {
  setMap(map: MapInstance | null): void
  setPosition(position: MapPoint): void
  getContent(): HTMLElement | string
  setContent(content: string): void
}

export interface MapPolyline {
  setMap(map: MapInstance | null): void
}

export interface MapNamespace {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => MapInstance
  Marker: new (options: Record<string, unknown>) => MapMarker
  Polyline: new (options: Record<string, unknown>) => MapPolyline
}
