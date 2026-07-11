import { describe, expect, it } from 'vitest'
import {
  normalizeMapPoint,
  toLeafletLatLng,
} from '@/features/details/components/PersonPoemTrackMap/services/mapLoader'

describe('Leaflet coordinate adapter', () => {
  it('keeps the internal coordinate order as lng-lat', () => {
    expect(normalizeMapPoint([108.9, 34.3])).toEqual([108.9, 34.3])
  })

  it('converts to Leaflet lat-lng order only at the adapter boundary', () => {
    expect(toLeafletLatLng([108.9, 34.3])).toEqual([34.3, 108.9])
  })

  it('does not replace invalid data with a fake location', () => {
    expect(normalizeMapPoint([999, 34.3])).toBeNull()
    expect(normalizeMapPoint(['invalid', 34.3])).toBeNull()
  })
})
