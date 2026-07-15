/**
 * 面包屑配色契约测试
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagesCss = readFileSync(resolve(process.cwd(), 'src/styles/_pages.css'), 'utf-8')

describe('面包屑配色契约', () => {
  it('应使用专题页的暖宣纸背景与金色边界', () => {
    expect(pagesCss).toMatch(/\.global-breadcrumb\s*\{[\s\S]*background:\s*rgba\(245, 240, 225, 0\.72\);/)
    expect(pagesCss).toMatch(/\.global-breadcrumb\s*\{[\s\S]*border-color:\s*rgba\(201, 162, 39, 0\.24\);/)
  })

  it('分隔符与当前层级应分别使用金色和深蓝色', () => {
    expect(pagesCss).toMatch(/\.global-breadcrumb-item:not\(:last-child\)::after\s*\{[\s\S]*color:\s*var\(--classic-gold\);/)
    expect(pagesCss).toMatch(/\.global-breadcrumb-item\.is-current\s*\{[\s\S]*color:\s*var\(--classic-primary\);/)
  })
})
