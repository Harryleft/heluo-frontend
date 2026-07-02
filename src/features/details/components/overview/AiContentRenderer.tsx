/**
 * AiContentRenderer - AI 内容 4 态渲染通用组件
 *
 * 统一处理 AI 介绍/赏析的 4 种状态渲染：
 * - 无数据 → 空消息
 * - 加载中 → 加载提示
 * - 成功 → 内容文本
 * - 错误 → 错误信息
 * - 重新生成按钮（有数据时显示）
 *
 * @module OverviewTab
 */

import type { AiServiceState } from '@/features/details/hooks/useAiServices'

export interface AiContentRendererProps {
  /** 是否有可用数据（如 referredContents 非空或有 fullText） */
  hasData: boolean
  /** 当前状态 */
  state: AiServiceState
  /** 成功时的内容文本 */
  content: string
  /** 错误时的错误信息 */
  error: string
  /** 无数据时的提示文本 */
  emptyMessage: string
  /** 加载中的提示文本 */
  loadingMessage: string
  /** 空内容时的提示文本（成功但内容为空） */
  emptyContentMessage?: string
  /** 刷新回调 */
  onRefresh: () => void
}

/**
 * AiContentRenderer - 4 态 AI 内容渲染器
 */
export function AiContentRenderer({
  hasData,
  state,
  content,
  error,
  emptyMessage,
  loadingMessage,
  emptyContentMessage,
  onRefresh,
}: AiContentRendererProps): JSX.Element {
  return (
    <div className="yale-sidebar-accordion__ai-content">
      {!hasData && (
        <p className="yale-sidebar-accordion__empty">{emptyMessage}</p>
      )}
      {hasData && state === 'loading' && (
        <p className="yale-sidebar-accordion__loading">{loadingMessage}</p>
      )}
      {hasData && state === 'error' && (
        <p className="yale-sidebar-accordion__error">{error}</p>
      )}
      {hasData && state === 'success' && (
        <p className="yale-sidebar-accordion__text">{content || emptyContentMessage || ''}</p>
      )}
      {hasData && state === 'idle' && (
        <p className="yale-sidebar-accordion__loading">{loadingMessage}</p>
      )}
      {hasData && (
        <button
          type="button"
          onClick={onRefresh}
          className="yale-sidebar-accordion__refresh-btn"
        >
          <i className="bi bi-arrow-clockwise" /> 重新生成
        </button>
      )}
    </div>
  )
}
