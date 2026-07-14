/**
 * 首页专题入口回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HomePageClassic } from '@/features/home/HomePageClassic'

vi.mock('@/lib/api/v1Api', () => ({
  fetchEntityCounts: vi.fn().mockResolvedValue({}),
}))

describe('首页人物专题入口', () => {
  it('应展示杜甫专题并提供可访问路由', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePageClassic />
        </MemoryRouter>,
      )
      await Promise.resolve()
    })

    expect(container.textContent).toContain('杜甫：从巩县出发的诗史人生')
    expect(container.querySelector('a[href="/topics/dufu-from-gongxian"]')?.textContent).toContain('进入专题')

    act(() => root.unmount())
    container.remove()
  })
})
