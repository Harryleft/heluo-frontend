import { describe, expect, it } from 'vitest'
import { isPersonPoemTrack } from '@/lib/api/contracts/personPoemTrackContract'

function buildTrack() {
  return {
    personId: '17270',
    personName: '杜甫',
    lifespan: { birth: 712, death: 770, label: '712-770' },
    dynasty: '唐',
    trackPoints: [
      {
        year: 766,
        yearLabel: '766年',
        place: {
          uri: '/processed/json-ld/place/CN500236.json',
          label: '奉节县',
          lng: 109.465,
          lat: 31.019,
          historicalNames: [],
        },
        poems: [{ id: 'poem_1', title: '示例', uri: '/processed/json-ld/poem/set/poem_1.json' }],
      },
    ],
    undatedPoems: [],
    stats: {
      totalPoems: 1,
      datedPoems: 1,
      placesCount: 1,
      yearRange: { start: 766, end: 766 },
    },
  }
}

describe('PersonPoemTrack contract', () => {
  it('accepts the canonical response shape', () => {
    expect(isPersonPoemTrack(buildTrack())).toBe(true)
  })

  it('allows dynasty to be absent', () => {
    const track = buildTrack()
    delete (track as { dynasty?: string }).dynasty

    expect(isPersonPoemTrack(track)).toBe(true)
  })

  it('rejects coordinates outside WGS84 bounds', () => {
    const track = buildTrack()
    track.trackPoints[0].place.lat = 91

    expect(isPersonPoemTrack(track)).toBe(false)
  })
})
