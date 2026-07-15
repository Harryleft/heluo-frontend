/**
 * 全局主导航“墨色导航带”样式契约
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../../src/styles/_pages.css', import.meta.url), 'utf8')

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))
  return match?.[1] ?? ''
}

describe('global header ink ribbon contract', () => {
  it('主导航应为三等分的深蓝通栏', () => {
    const headerInner = rule('.global-header-inner')
    const nav = rule('.global-header-nav')

    expect(headerInner).toContain('flex-wrap: wrap')
    expect(headerInner).toContain('height: auto')
    expect(nav).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(nav).toContain('background: var(--classic-primary)')
    expect(nav).toContain('min-height: 48px')
  })

  it('导航项应移除胶囊，当前项使用金色文字和短金线', () => {
    const item = rule('.global-header-nav-item')
    const active = rule('.global-header-nav-item.is-active')
    const marker = rule('.global-header-nav-item.is-active::after')

    expect(item).toContain('border-radius: 0')
    expect(item).toContain('background: transparent')
    expect(active).toContain('color: var(--classic-gold-light)')
    expect(active).toContain('box-shadow: none')
    expect(marker).toContain('width: 56px')
    expect(marker).toContain('height: 2px')
    expect(marker).toContain('background: var(--classic-gold-light)')
  })
})
