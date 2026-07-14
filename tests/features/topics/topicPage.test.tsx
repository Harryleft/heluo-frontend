/**
 * 人物专题页回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { TopicPage } from '@/features/topics/TopicPage'
import { DUFU_TOPIC } from '@/features/topics/topicData'

function mount(node: JSX.Element): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return { container, root }
}

describe('杜甫人物专题页', () => {
  it('应以可复用配置渲染完整叙事与资料入口', () => {
    const { container, root } = mount(
      <MemoryRouter>
        <TopicPage topic={DUFU_TOPIC} />
      </MemoryRouter>,
    )

    expect(container.querySelector('h1')?.textContent).toBe('杜甫：从巩县出发的诗史人生')
    expect(container.querySelectorAll('[data-topic-chapter]').length).toBe(7)
    expect(container.textContent).toContain('46 种传记资料')
    expect(container.textContent).toContain('1,289 篇诗文')

    const detailLink = container.querySelector('a[href="/details?uri=%2Fperson%2F17270"]')
    expect(detailLink?.textContent).toContain('查看杜甫人物详情')

    act(() => root.unmount())
    container.remove()
  })
})
