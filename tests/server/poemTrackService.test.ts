import { describe, expect, it } from 'vitest'
import { parseWktPoint } from '../../server/src/domain/track/poemTrackService.js'

describe('poem track coordinate parsing', () => {
  it('parses valid WKT as lng-lat', () => {
    expect(parseWktPoint('POINT(108.946306 34.347436)')).toEqual({
      lng: 108.946306,
      lat: 34.347436,
    })
  })

  it('rejects invalid and out-of-range WKT', () => {
    expect(parseWktPoint('POINT(181 34)')).toBeNull()
    expect(parseWktPoint('POINT(108 91)')).toBeNull()
    expect(parseWktPoint('not-a-point')).toBeNull()
  })
})
