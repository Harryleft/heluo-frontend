/**
 * 人物介绍降级策略
 *
 * @module server/src/services/llm/fallback/personIntroFallback
 */

import { normalizePlainText } from '../utils/index.js'

/**
 * 构建人物 AI 介绍降级文本
 */
export function buildPersonAiIntroFallback(name, referredContents = []) {
  const safeName = normalizePlainText(name, 80) || '该人物'
  const highlights = referredContents.slice(0, 4)

  if (!highlights.length) {
    return `${safeName}的现有资料较少，暂时无法生成可靠介绍。建议补充生平、时代和代表事迹后再试。`
  }

  return `${safeName}的资料主要提到: ${highlights.join(';')}。整体来看，这是一个在相关文献中有明确记载的人物。 `
}
