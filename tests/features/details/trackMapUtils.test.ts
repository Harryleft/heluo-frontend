import { describe, expect, it } from 'vitest'

import type { PoemTrackPoint } from '@/types/contracts/poemTrackContracts'
import {
  buildTrackPath,
  getVisibleTrackPoints,
  groupVisibleTrackPointsByPlace,
} from '@/features/details/components/PersonPoemTrackMap/utils/trackUtils'

function point(year: number, place: string, lng: number, lat: number, poems: number): PoemTrackPoint {
  return {
    year,
    yearLabel: `${year}年`,
    place: { uri: place, label: place, lng, lat },
    poems: Array.from({ length: poems }, (_, index) => ({
      id: `${year}-${place}-${index}`,
      title: `诗文 ${index}`,
      uri: `/poem/${year}-${place}-${index}`,
    })),
  }
}

describe('track map display model', () => {
  const points = [
    point(736, 'taian', 117.1, 36.2, 1),
    point(736, 'yanzhou', 116.75, 35.57, 2),
    point(737, 'yanzhou', 116.75, 35.57, 3),
    point(738, 'changan', 108.95, 34.35, 4),
  ]

  it('defaults to the earliest year instead of flashing the full lifetime track', () => {
    expect(getVisibleTrackPoints(points, null).map((item) => item.year)).toEqual([736, 736])
  })

  it('uses one dominant place per year and removes consecutive duplicate coordinates', () => {
    expect(buildTrackPath(points, 738)).toEqual([
      { lng: 116.75, lat: 35.57 },
      { lng: 108.95, lat: 34.35 },
    ])
  })

  it('merges repeated place markers and accumulates their poem counts', () => {
    const groups = groupVisibleTrackPointsByPlace(points, 737)
    const yanzhou = groups.find((group) => group.representative.place.uri === 'yanzhou')

    expect(groups).toHaveLength(2)
    expect(yanzhou).toMatchObject({ poemCount: 5, startYear: 736, endYear: 737 })
    expect(yanzhou?.representative.year).toBe(737)
  })
})
