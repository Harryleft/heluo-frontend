export interface GeoPoint {
  lng: number
  lat: number
}

export function isWgs84Coordinate(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}

export function parseWktPoint(value: unknown): GeoPoint | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/i)
  if (!match) return null
  const lng = Number.parseFloat(match[1] || '')
  const lat = Number.parseFloat(match[2] || '')
  return isWgs84Coordinate(lng, lat) ? { lng, lat } : null
}
