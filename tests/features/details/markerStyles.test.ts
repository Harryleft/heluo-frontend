import { describe, expect, it } from 'vitest'

import { INK_COLORS } from '@/features/details/components/PersonPoemTrackMap/styles/inkColors'
import { createMarkerContent } from '@/features/details/components/PersonPoemTrackMap/styles/markerStyles'

describe('poem track marker styles', () => {
  const yearRange = { start: 736, end: 770 }

  it('uses a vermilion seal for the selected place', () => {
    const content = createMarkerContent(12, 750, yearRange, true)

    expect(content).toContain('poem-track-marker--current')
    expect(content).toContain(INK_COLORS.vermilion)
  })

  it('keeps historical places in the ink palette', () => {
    const content = createMarkerContent(4, 736, yearRange, false)

    expect(content).toContain('poem-track-marker--historical')
    expect(content).toContain(INK_COLORS.dark)
    expect(content).not.toContain(INK_COLORS.vermilion)
  })
})
