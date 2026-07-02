/**
 * SidebarAccordion 回归测试
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { SidebarAccordion, type AccordionItem } from '@/features/details/components/overview/SidebarAccordion'

function mount(node: JSX.Element): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return { container, root }
}

function unmount(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount()
  })
  container.remove()
}

function getAccordionHeaders(container: HTMLDivElement): HTMLDivElement[] {
  return Array.from(container.querySelectorAll('.yale-sidebar-accordion__item-header')) as HTMLDivElement[]
}

function getAccordionContent(container: HTMLDivElement, id: string): HTMLDivElement | null {
  return container.querySelector(`#accordion-content-${id}`) as HTMLDivElement | null
}

describe('SidebarAccordion', () => {
  const mountedRoots: Array<{ container: HTMLDivElement; root: Root }> = []

  afterEach(() => {
    while (mountedRoots.length > 0) {
      const mounted = mountedRoots.pop()
      if (mounted) {
        unmount(mounted.root, mounted.container)
      }
    }
  })

  it('应允许推荐资源与外部链接同时展开', () => {
    const items: AccordionItem[] = [
      {
        id: 'related-resources',
        title: '推荐资源',
        content: () => <div>推荐资源内容</div>,
      },
      {
        id: 'external-links',
        title: '外部链接',
        content: () => <div>外部链接内容</div>,
      },
    ]

    const mounted = mount(<SidebarAccordion items={items} />)
    mountedRoots.push(mounted)

    const [, externalHeader] = getAccordionHeaders(mounted.container)

    act(() => {
      externalHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(getAccordionContent(mounted.container, 'related-resources')?.getAttribute('aria-hidden')).toBe('false')
    expect(getAccordionContent(mounted.container, 'external-links')?.getAttribute('aria-hidden')).toBe('false')
    expect(mounted.container.textContent || '').toContain('推荐资源内容')
    expect(mounted.container.textContent || '').toContain('外部链接内容')
  })

  it('关闭当前区块时不应影响其他已展开区块', () => {
    const items: AccordionItem[] = [
      {
        id: 'related-resources',
        title: '推荐资源',
        content: () => <div>推荐资源内容</div>,
      },
      {
        id: 'external-links',
        title: '外部链接',
        content: () => <div>外部链接内容</div>,
      },
    ]

    const mounted = mount(<SidebarAccordion items={items} />)
    mountedRoots.push(mounted)

    const [, externalHeader] = getAccordionHeaders(mounted.container)

    act(() => {
      externalHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    act(() => {
      externalHeader.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(getAccordionContent(mounted.container, 'related-resources')?.getAttribute('aria-hidden')).toBe('false')
    expect(getAccordionContent(mounted.container, 'external-links')?.getAttribute('aria-hidden')).toBe('true')
    expect(mounted.container.textContent || '').toContain('推荐资源内容')
    expect(mounted.container.textContent || '').not.toContain('外部链接内容')
  })
})
