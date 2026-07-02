/**
 * entityExtract 单元测试
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { extractPoemCreationTime } from '@/features/details/utils/entityExtract'

describe('entityExtract', () => {
  it('诗文创作时间应优先使用可读标签，不拼接 ISO 时间', () => {
    const value = extractPoemCreationTime({
      created_by: {
        timespan: {
          _label: '767年',
          begin_of_the_begin: '0767-01-01T00:00:00Z',
          end_of_the_end: '0767-12-31T23:59:59Z',
        },
      },
    })

    expect(value).toBe('767年')
  })
})
