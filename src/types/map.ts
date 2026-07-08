/**
 * 地图对象类型定义
 */

export interface MapInstance {
 setFitView(): void
 destroy(): void
 setCenter(center: [number, number]): void
 setZoom(zoom: number): void
 getBounds(): { getSouthWest(): { lng: number; lat: number }; getNorthEast(): { lng: number; lat: number } }
 getNativeMap?(): unknown
 panTo(center: [number, number]): void
 addControl(control: unknown): void
}

export interface MapMarker {
  setMap(map: MapInstance | null): void
  setPosition(position: [number, number]): void
  getContent(): HTMLElement | string
  setContent(content: HTMLElement | string): void
}

export interface MapPolyline {
  setMap(map: MapInstance | null): void
}
