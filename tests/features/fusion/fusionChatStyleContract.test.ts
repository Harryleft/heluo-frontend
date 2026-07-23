/**
 * 融合问答样式契约测试
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pagesCssPath = resolve(process.cwd(), 'src/styles/_pages.css')
const pagesCss = readFileSync(pagesCssPath, 'utf-8')
const fusionChatPath = resolve(process.cwd(), 'src/features/fusion/FusionChat.tsx')
const fusionChatSource = readFileSync(fusionChatPath, 'utf-8')

describe('FusionChat 样式契约', () => {
  it('欢迎区根容器应具备水平居中规则', () => {
    expect(pagesCss).toMatch(/\.fusion-chat-native\s+\.aui-thread-welcome-root\s*\{[\s\S]*align-self:\s*center;/)
  })

  it('欢迎态应包含输入优先标题、证据提示与分类索引文案', () => {
    expect(fusionChatSource).toContain('从一个问题，进入河洛文献')
    expect(fusionChatSource).toContain('回答将附检索证据')
    expect(fusionChatSource).toContain("category: '人物'")
    expect(fusionChatSource).toContain('aria-label="输入问题"')
    expect(fusionChatSource).toContain('autoFocus={false}')
  })

  it('聊天画布应移除大卡片和粒子装饰', () => {
    expect(pagesCss).toMatch(/\.fusion-chat-native\s+\.aui-thread-root\s*\{[\s\S]*border:\s*0;[\s\S]*border-radius:\s*0;[\s\S]*box-shadow:\s*none;/)
    expect(pagesCss).toMatch(/\.fusion-chat-native\s+\.aui-thread-root::before,[\s\S]*\.aui-thread-root::after\s*\{[\s\S]*display:\s*none;/)
  })

  it('示例问题应呈现为三列索引行而不是卡片', () => {
    expect(pagesCss).toMatch(/\.fusion-chat-native-welcome-index-item\s*\{[\s\S]*grid-template-columns:\s*72px\s+minmax\(0,\s*1fr\)\s+24px;[\s\S]*border-bottom:/)
    expect(pagesCss).toMatch(/\.fusion-chat-native-welcome-index-item\s*\{[\s\S]*border-radius:\s*0;[\s\S]*background:\s*transparent;/)
  })

  it('移动端发送按钮应固定在输入框右侧，金色小字应使用可读文本色', () => {
    expect(pagesCss).toMatch(/\.fusion-chat-native\s+\.aui-composer-send,[\s\S]*position:\s*absolute;[\s\S]*right:\s*22px;/)
    expect(pagesCss).toMatch(/@media\s*\(max-width:\s*768px\)[\s\S]*\.fusion-chat-native\s+\.aui-composer-send,[\s\S]*right:\s*16px;/)
    expect(pagesCss).toContain('color: var(--classic-gold-text);')
  })

  it('助手消息应彻底隐藏头像且不保留图片资源引用', () => {
    expect(fusionChatSource).toContain('assistantAvatar={{}}')
    expect(fusionChatSource).not.toContain('heluo-literature-assistant-avatar')
    expect(pagesCss).not.toMatch(/\.fusion-chat-native\s+\.aui-assistant-message-root\s*>\s*\.aui-avatar-root/)
  })
})
