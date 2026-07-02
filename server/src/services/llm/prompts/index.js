/**
 * 提示词模块入口
 *
 * @module server/src/services/llm/prompts
 */

import { clipEvidenceText, normalizePlainText } from '../utils/index.js'
import { extractFusionPoemCompareTitle, isFusionPoemCompareQuestion } from '../../../domain/fusion/queryPlanner.js'

/**
 * RAG 系统提示词模板
 */
const RAG_SYSTEM_PROMPT = `【角色】
你是"河洛"，一个专注中国古典文学、历史、地理和哲学的知识问答助手。

【规则】
1) 优先依据已提供的参考材料作答，禁止编造不存在的细节。
2) 当参考材料不足以支撑完整结论时，可基于你的通识知识进行补充回答，但必须明确标注“以下为基于通识知识的补充说明”。
3) 输出纯文本，不要使用 Markdown 标记，不输出编号证据标签，不要输出“[实体资料x][文献证据x]”。
4) 直接解读文本与问题关系，不描述检索流程。
5) 先对候选材料做相关性筛选，只能使用与问题直接相关的材料作答。
6) 不得在正文中点名或展开任何已判定为无关、未采纳的材料。
7) 若问题要求列举作品（如“有哪些”），需在已给材料范围内逐首全量列出相关作品，不得遗漏。
8) 对每首被采纳的诗作，至少覆盖写作对象关系、主题情感、时代语境、艺术手法四个维度，进行多维度分析与逐首诗句细读。
9) IIIF 命中时只解释文本信息与问题关系，不解释技术框架。
10) 回答先给结论，再给简要解释,多轮对话需保持上下文一致。
11) 多轮对话中，必须优先回答当前轮问题；如果当前轮问题与上一轮主题不同，不得回到上一轮重新作答。
12) 只有当当前轮问题出现“这首”“这两首”“它”“其”等承接表达时，才允许结合历史对话补全指代。
13) 历史对话只作为理解上下文的辅助信息，不能覆盖当前轮问题主体。

【输入】
你将收到两类输入：
1) 参考材料（实体资料、文献证据、IIIF 注释文本）；
2) 用户问题。

【风格】
中文、客观、简洁、可读性高。优先回答与问题直接相关的内容。

【输出】
直接输出最终答案正文，不附加任何模板说明、标题或标签。`

function normalizeComparePoemEvidence(items = []) {
  const output = []
  const seenUris = new Set()

  for (const item of items) {
    const title = normalizePlainText(item?.title, 120)
    const uri = normalizePlainText(item?.uri, 240)
    const poemText = normalizePlainText(item?.poemText || item?.fullText, 3000)
    if (!title || !uri || !poemText || seenUris.has(uri)) continue
    seenUris.add(uri)
    output.push({
      title,
      uri,
      poemText,
      poemAuthor: normalizePlainText(item?.poemAuthor, 80),
      poemDynasty: normalizePlainText(item?.poemDynasty, 40),
      poemIntro: normalizePlainText(item?.poemIntro, 400),
    })
    if (output.length >= 4) break
  }

  return output
}

function collectComparePoemEvidenceFromMaterials(targetTitle, entities = [], citations = []) {
  if (!targetTitle) return []

  const candidates = []
  const pushCandidate = (item, typeLabel = '') => {
    const title = normalizePlainText(item?.title, 120)
    const uri = normalizePlainText(item?.uri, 240)
    const type = normalizePlainText(item?.type || item?.sourceType, 40)
    if (title !== targetTitle || type !== 'poem' || !uri) return
    candidates.push({
      title,
      uri,
      poemText: normalizePlainText(item?.poemText || item?.fullText, 3000),
      poemAuthor: normalizePlainText(item?.poemAuthor, 80),
      poemDynasty: normalizePlainText(item?.poemDynasty, 40),
      poemIntro: normalizePlainText(item?.poemIntro, 400),
      score: Number(item?.scoreDetail?.finalScore || item?.score || 0),
      source: typeLabel,
    })
  }

  entities.forEach((item) => pushCandidate(item, 'entity'))
  citations.forEach((item) => pushCandidate(item, 'citation'))

  candidates.sort((a, b) => b.score - a.score)
  return normalizeComparePoemEvidence(candidates)
}

function resolveComparePromptContext({
  query,
  entities = [],
  citations = [],
  compareIntent = null,
  comparePoemEvidence = [],
}) {
  const fallbackTargetTitle = extractFusionPoemCompareTitle(query)
  const inferredCompareIntent = compareIntent?.intent
    ? compareIntent
    : (isFusionPoemCompareQuestion(query) && fallbackTargetTitle
      ? { intent: 'poem_compare_by_title', title: fallbackTargetTitle }
      : null)

  if (inferredCompareIntent?.intent !== 'poem_compare_by_title') {
    return {
      compareIntent: null,
      comparePoemEvidence: [],
      compareBlock: '',
      compareInstruction: '',
    }
  }

  const targetTitle = normalizePlainText(inferredCompareIntent?.title, 120) || fallbackTargetTitle
  const normalizedCompareEvidence = normalizeComparePoemEvidence(comparePoemEvidence)
  const effectiveCompareEvidence = normalizedCompareEvidence.length > 0
    ? normalizedCompareEvidence
    : collectComparePoemEvidenceFromMaterials(targetTitle, entities, citations)

  if (effectiveCompareEvidence.length < 2) {
    return {
      compareIntent: {
        intent: 'poem_compare_by_title',
        title: targetTitle,
      },
      comparePoemEvidence: effectiveCompareEvidence,
      compareInstruction: '这是同名诗作比较题。若可比较材料不足两首，必须明确说明材料不足，不得把同题不同诗合并为一首。',
      compareBlock: `比较对象清单：\n当前材料不足以完成同题比较：题目《${targetTitle || '未识别诗题'}》目前仅有 ${effectiveCompareEvidence.length} 首具备可用正文。禁止把重复标题误判为同一首诗。`,
    }
  }

  const compareItems = effectiveCompareEvidence.map((item, index) => [
    `对象${index + 1}`,
    `标题：${item.title}`,
    `标识：${item.uri}`,
    item.poemAuthor ? `作者：${clipEvidenceText(item.poemAuthor, 80)}` : '',
    item.poemDynasty ? `朝代：${clipEvidenceText(item.poemDynasty, 40)}` : '',
    item.poemIntro ? `背景：${clipEvidenceText(item.poemIntro, 240)}` : '',
    `正文：${clipEvidenceText(item.poemText, 1600)}`,
  ].filter(Boolean).join('\n'))

  return {
    compareIntent: {
      intent: 'poem_compare_by_title',
      title: targetTitle,
    },
    comparePoemEvidence: effectiveCompareEvidence,
    compareInstruction: '这是同名诗作比较题，必须逐首比较，不得把同题不同诗合并为一首；若材料不足两首，必须明确说明不足。',
    compareBlock: `比较对象清单：\n${compareItems.join('\n\n')}`,
  }
}

/**
 * 构建 RAG Prompt
 * @param {object} params
 * @returns {Array}
 */
export function buildRagPrompt({
  query,
  entities = [],
  citations = [],
  iiifMatches = [],
  conversationHistory = [],
  compareIntent = null,
  comparePoemEvidence = [],
}) {
  const compareContext = resolveComparePromptContext({
    query,
    entities,
    citations,
    compareIntent,
    comparePoemEvidence,
  })
  const systemPrompt = compareContext.compareInstruction
    ? `${RAG_SYSTEM_PROMPT}\n14) ${compareContext.compareInstruction}`
    : RAG_SYSTEM_PROMPT
  const messages = [{ role: 'system', content: systemPrompt }]

  // 构建证据块
  const evidenceItems = []

  // 实体证据
  if (entities.length > 0) {
    const entityItems = entities.slice(0, 10).map((e) => {
      const scoreLabel = e.score > 0 ? `，相关度:${(e.score * 100).toFixed(0)}%` : ''
      const poemMeta = []
      if (e.poemAuthor) poemMeta.push(`作者：${clipEvidenceText(e.poemAuthor, 80)}`)
      if (e.poemDynasty) poemMeta.push(`朝代：${clipEvidenceText(e.poemDynasty, 40)}`)
      if (e.poemIntro) poemMeta.push(`背景：${clipEvidenceText(e.poemIntro, 240)}`)
      const poemText = clipEvidenceText(e.poemText || e.fullText || '', 1600)
      return [
        `标题：${e.title || '未命名'}`,
        `类型：${e.type || '未知类型'}${scoreLabel}`,
        `内容：${clipEvidenceText(e.snippet || '暂无描述', 280)}`,
        ...poemMeta,
        poemText ? `诗文原文：${poemText}` : '',
      ].filter(Boolean).join('\n')
    })
    evidenceItems.push(...entityItems)
  }

  // 引用证据
  if (citations.length > 0) {
    const citationItems = citations.slice(0, 10).map((c) => {
      const scoreLabel = c.scoreDetail?.finalScore > 0
        ? `，相关度:${(c.scoreDetail.finalScore * 100).toFixed(0)}%`
          : ''
      const poemMeta = []
      if (c.poemAuthor) poemMeta.push(`作者：${clipEvidenceText(c.poemAuthor, 80)}`)
      if (c.poemDynasty) poemMeta.push(`朝代：${clipEvidenceText(c.poemDynasty, 40)}`)
      if (c.poemIntro) poemMeta.push(`背景：${clipEvidenceText(c.poemIntro, 240)}`)
      const poemText = clipEvidenceText(c.poemText || c.fullText || '', 1600)
      return [
        `标题：${c.title || '未命名'}`,
        `类型：${c.sourceType || '未知来源'}${scoreLabel}`,
        `内容：${clipEvidenceText(c.snippet || '暂无内容', 280)}`,
        ...poemMeta,
        poemText ? `诗文原文：${poemText}` : '',
      ].filter(Boolean).join('\n')
    })
    evidenceItems.push(...citationItems)
  }

  // IIIF 证据
  if (iiifMatches.length > 0) {
    const iiifItems = iiifMatches.slice(0, 5).map((item, index) => {
      const segmentText = clipEvidenceText(item.segmentText || item.text || '', 1200)
      const canvasLabel = clipEvidenceText(item.canvasLabel || '', 120)
      const canvasId = clipEvidenceText(item.canvasId || '', 240)
      const manifest = clipEvidenceText(item.manifest || '', 240)
      return [
        `标题：IIIF注释文本${index + 1}`,
        `类型：iiif_text`,
        canvasLabel ? `画布：${canvasLabel}` : '',
        canvasId ? `画布ID：${canvasId}` : '',
        manifest ? `清单：${manifest}` : '',
        `内容：${segmentText || '暂无内容'}`,
      ].filter(Boolean).join('\n')
    })
    evidenceItems.push(...iiifItems)
  }

  const evidenceBlock = evidenceItems.length > 0
    ? `可用参考信息如下：  \n\n${evidenceItems.map((item, index) => `材料${index + 1}\n${item}`).join('\n\n')}`
    : '（未检索到相关证据）'
  const compareBlock = compareContext.compareBlock ? `${compareContext.compareBlock}\n\n` : ''

  const userPrompt = `【角色】
你是"河洛"知识问答助手。

【规则】
严格按系统规则回答，不编造，不输出 Markdown，不输出证据编号标签。
先筛选相关材料，再组织答案；不要提及无关或未采纳材料。
当材料不足时，允许给出“基于通识知识的补充说明”，并与材料结论分开表达。
多轮对话中，最后一个用户问题就是当前轮问题，必须优先回答；除非当前轮存在明显省略指代，否则不要依赖历史改写当前问题。

【输入】
参考材料：
${compareBlock}${evidenceBlock}

用户问题： ${query}

【风格】
先结论后解释，逐首细读时覆盖四个维度。

【输出】
请直接输出最终答案正文。 `

  // 添加对话历史
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory)
  }

  // 当前轮问题必须放在最后，避免被历史消息覆盖
  messages.push({ role: 'user', content: userPrompt })

  return messages
}

/**
 * 规范化诗文分析输入
 */
export function normalizePoemAnalysisInput(input = {}) {
  return {
    title: normalizePlainText(input?.title, 120),
    author: normalizePlainText(input?.author, 80),
    dynasty: normalizePlainText(input?.dynasty, 40),
    fullText: normalizePlainText(input?.fullText, 5000),
    background: normalizePlainText(input?.background, 1200),
    creationTime: normalizePlainText(input?.creationTime, 120),
    geoContext: normalizePlainText(input?.geoContext, 240),
  }
}

/**
 * 构建诗文分析提示词
 */
export function buildPoemAiAnalysisPrompt(input = {}) {
  const { title, author, dynasty, fullText, background, creationTime, geoContext } = normalizePoemAnalysisInput(input)

  const systemPrompt = `【角色】
你是一个中国古典诗文解读助手，负责输出面向普通读者的赏析文本。

【规则】
1) 严格依据输入材料作答，不允许编造作者生平、创作背景或典故；
2) 输入信息不足时，必须明确指出不确定性；
3) 输出纯文本，不使用 Markdown 和项目符号；
4) 不描述推理或检索流程，不输出模板标签；
5) 必须使用简体中文输出，禁止夹杂英文单词或英文短语。

【输入】
你将收到诗题、作者、朝代、创作时间线索、地理线索、正文和可选背景信息。

【风格】
先总评，再分层解读；语言通俗、准确、节制,面向普通读者。

【输出】
输出 2 到 4 段赏析正文,覆盖主旨情感、关键意象、表达手法与可读性总结。 `

  const userPrompt = `【角色】
你是中国古典诗文解读助手。

【规则】
仅依据给定材料解读,禁止编造,不确定时直接说明。必须使用简体中文输出,禁止夹杂英文单词或英文短语。

【输入】
诗题： ${title || '未知'}
作者： ${author || '未知'}
朝代： ${dynasty || '未知'}
创作时间： ${creationTime || '未知'}
地理信息： ${geoContext || '未知'}
正文：
 ${fullText || '（未提供正文）'}
背景信息：
 ${background || '（未提供背景）'}

【风格】
先总评后细读,语言自然,避免术语堆砌。

【输出】
请直接输出最终赏析文本。 `

  return { systemPrompt, userPrompt }
}

/**
 * 构建诗文分析降级文本
 */
export function buildPoemAiAnalysisFallback(input = {}) {
  const { title, author, dynasty, fullText, creationTime, geoContext } = normalizePoemAnalysisInput(input)
  const safeTitle = title || '该诗文'
  const authorLabel = author ? `作者为${author}` : '作者信息暂缺'
  const dynastyLabel = dynasty ? `，时代为${dynasty}` : ''
  const timeLabel = creationTime ? `，创作时间线索为${creationTime}` : ''
  const geoLabel = geoContext ? `，地理线索为${geoContext}` : ''

  if (!fullText) {
    return `${safeTitle}${authorLabel}${dynastyLabel}${timeLabel}${geoLabel}。现有材料缺少正文,暂时无法给出可靠赏析,建议补充全文后再试。`
  }

  const preview = clipEvidenceText(fullText, 90)
  return `${safeTitle}${authorLabel}${dynastyLabel}${timeLabel}${geoLabel}。从现有正文看,文本可能围绕核心意象与情感展开: ${preview}。由于背景材料有限,本解读仅供参考。`
}
