/**
 * 古籍层次结构处理模块
 *
 * 负责构建和管理古籍的层次结构（根 -> 部 -> 条目）
 *
 * @module server/src/domain/detail/ancientBook/hierarchy
 */

import { pickNodeLabel, extractIdFromUri } from './utils.js'
import {
  classifyAncientBookHierarchyLevel,
  resolveAncientBookSetUriByDocId,
} from './uriParser.js'

/**
 * 获取古籍层次父节点
 *
 * @param {object} doc - 文档对象
 * @returns {object|null} 父节点或 null
 */
export function pickAncientBookHierarchyParentNode(doc) {
  const memberOf = Array.isArray(doc?.member_of) ? doc.member_of : [doc?.member_of]
  for (const item of memberOf) {
    if (!item || typeof item !== 'object') continue
    const nodeId = String(item.id || '').trim()
    if (nodeId.includes('/set/ancient-book/')) return item
  }
  return null
}

/**
 * 去重古籍层次节点
 *
 * @param {Array} nodes - 节点数组
 * @returns {Array} 去重后的节点数组
 */
export function dedupeAncientBookHierarchy(nodes = []) {
  const output = []
  const seen = new Set()
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node || typeof node !== 'object') continue
    const key = `${String(node.level || '')}|${String(node.docId || '')}|${String(node.uri || '')}|${String(node.id || '')}|${String(node.label || '')}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(node)
  }
  return output
}

/**
 * 构建古籍层次结构
 *
 * 从当前文档向上遍历 member_of 关系，构建完整的层次结构路径
 *
 * @param {string} uri - 文档 URI
 * @param {object} doc - 文档对象
 * @param {string} title - 标题
 * @param {object} dependencies - 依赖注入 { mlGetDoc }
 * @returns {Promise<Array>} 层次结构数组（从根到叶）
 */
export async function buildAncientBookHierarchy(uri, doc, title, dependencies) {
  const { mlGetDoc } = dependencies
  const leafDocId = String(doc?.id || '').trim()
  const leafNode = {
    level: classifyAncientBookHierarchyLevel(uri, leafDocId),
    id: extractIdFromUri(uri) || leafDocId.split('/').pop() || '',
    label: String(title || '').trim() || pickNodeLabel(doc) || '未命名古籍',
    uri: String(uri || '').trim() || undefined,
    docId: leafDocId || undefined,
  }

  const ancestors = []
  const visited = new Set()
  let current = pickAncientBookHierarchyParentNode(doc)

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== 'object') break
    const currentDocId = String(current.id || '').trim()
    const currentUri = resolveAncientBookSetUriByDocId(currentDocId)
    const visitKey = currentDocId || currentUri || String(pickNodeLabel(current) || '')
    if (!visitKey || visited.has(visitKey)) break
    visited.add(visitKey)

    let parentDoc = null
    if (currentUri) {
      parentDoc = await mlGetDoc(currentUri)
    }

    const currentLabel = pickNodeLabel(current) || pickNodeLabel(parentDoc)
    const currentLevel = classifyAncientBookHierarchyLevel(currentUri, currentDocId)
    const currentId = extractIdFromUri(currentUri) || currentDocId.split('/').pop() || currentLabel || ''

    if (currentLabel || currentId) {
      ancestors.push({
        level: currentLevel,
        id: currentId,
        label: currentLabel || currentId,
        uri: currentUri || undefined,
        docId: currentDocId || undefined,
      })
    }

    current = parentDoc && typeof parentDoc === 'object' ? pickAncientBookHierarchyParentNode(parentDoc) : null
  }

  const merged = dedupeAncientBookHierarchy([...ancestors.reverse(), leafNode]).filter((node) =>
    String(node.label || '').trim(),
  )
  return merged
}
