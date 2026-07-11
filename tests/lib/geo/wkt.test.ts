import { describe, expect, it } from 'vitest'
import { isWgs84Coordinate, parseWktPoint } from '@/lib/geo/wkt'

describe('WGS84 coordinate contract', () => {
  it('parses WKT in lng-lat order', () => {
    expect(parseWktPoint('POINT(108.946306 34.347436)')).toEqual({
      lng: 108.946306,
      lat: 34.347436,
    })
  })

  it('rejects out-of-range coordinates', () => {
    expect(parseWktPoint('POINT(181 34)')).toBeNull()
    expect(parseWktPoint('POINT(108 91)')).toBeNull()
    expect(isWgs84Coordinate(-180, -90)).toBe(true)
    expect(isWgs84Coordinate(180, 90)).toBe(true)
  })
})
