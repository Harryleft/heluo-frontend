/**
 * GlobalHeader visibility tests
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { shouldShowGlobalHeader } from '@/features/common/GlobalHeader'

describe('shouldShowGlobalHeader', () => {
  it('Mirador 内嵌查看器页不显示全局搜索页头', () => {
    expect(shouldShowGlobalHeader('/mirador')).toBe(false)
    expect(shouldShowGlobalHeader('/details')).toBe(true)
  })
})
