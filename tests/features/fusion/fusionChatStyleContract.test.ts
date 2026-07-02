/**
 * 融合问答样式契约测试
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagesCssPath = resolve(process.cwd(), 'src/styles/_pages.css')
const pagesCss = readFileSync(pagesCssPath, 'utf-8')

describe('FusionChat 样式契约', () => {
  it('欢迎区根容器应具备水平居中规则', () => {
    expect(pagesCss).toMatch(/\.fusion-chat-native\s+\.aui-thread-welcome-root\s*\{[\s\S]*align-self:\s*center;/)
  })
})
