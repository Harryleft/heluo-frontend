/**
 * SidebarAccordion - 侧栏折叠面板组件（书斋式设计）
 *
 * 灵感来源：传统册页装帧与文人书案布局
 * 展开时左侧金色竖线指示当前章节
 *
 * @module OverviewTab
 */

import { useState, useEffect, useRef, useMemo, KeyboardEvent, ReactNode } from 'react'

// Types
import type { InlineStyleWithVar } from '@/features/details/types/overviewTab'

// Styles - 动态注入
import { injectStyles } from '@/lib/dom/injectStyles'
import sidebarAccordionStyles from '@/styles/features/details/OverviewTab/SidebarAccordion'

/**
 * 折叠面板项配置
 */
export interface AccordionItem {
  /** 唯一标识 */
  id: string
  /** 标题 */
  title: string
  /** 图标 (Bootstrap Icons class，如 'bi-cpu') */
  icon?: string
  /** 内容计数（可选） */
  count?: number
  /** 内容渲染函数 */
  content: () => ReactNode
  /** 默认是否展开 */
  defaultExpanded?: boolean
  /** 内容体额外类名 */
  bodyClassName?: string
}

/**
 * SidebarAccordion Props
 */
export interface SidebarAccordionProps {
  /** 面板项列表 */
  items: AccordionItem[]
  /** 额外类名 */
  className?: string
}

/**
 * SidebarAccordion - 侧栏折叠面板（书斋式）
 *
 * 特性：
 * - 册页式统一容器，整体感更强
 * - 展开时左侧金色竖线指示
 * - 平滑的 cubic-bezier 展开/折叠动画
 * - 键盘可访问性
 * - 多选模式（可同时展开多个区块）
 * - 智能展开：响应 defaultExpanded 变化自动展开
 */
export function SidebarAccordion({ items, className = '' }: SidebarAccordionProps): JSX.Element {
  // 注入样式
  injectStyles('sidebar-accordion', sidebarAccordionStyles)

  // 收集默认展开项；若没有显式默认值，则首项保持展开
  const defaultExpandedIds = useMemo(() => {
    const expandedItems = items.filter((item) => item.defaultExpanded).map((item) => item.id)
    if (expandedItems.length > 0) return expandedItems
    return items[0]?.id ? [items[0].id] : []
  }, [items])

  // 展开状态
  const [expandedIds, setExpandedIds] = useState<string[]>(defaultExpandedIds)

  // 记录上一次的默认展开签名，用于检测变化
  const prevDefaultExpandedKeyRef = useRef<string>('')

  // 智能展开：
  // 1. 面板集合变化时，移除已不存在的展开项
  // 2. 若当前没有任何展开项，且默认展开集合发生变化，则自动展开默认项
  useEffect(() => {
    const prevDefaultKey = prevDefaultExpandedKeyRef.current
    const nextDefaultKey = defaultExpandedIds.join('|')

    prevDefaultExpandedKeyRef.current = nextDefaultKey

    setExpandedIds((prevExpandedIds) => {
      const validExpandedIds = prevExpandedIds.filter((id) => items.some((item) => item.id === id))

      if (validExpandedIds.length > 0) {
        return validExpandedIds
      }

      if (defaultExpandedIds.length > 0 && prevDefaultKey !== nextDefaultKey) {
        return defaultExpandedIds
      }

      return validExpandedIds
    })
  }, [defaultExpandedIds, items])

  const handleToggle = (id: string) => {
    setExpandedIds((prevExpandedIds) => (
      prevExpandedIds.includes(id)
        ? prevExpandedIds.filter((expandedId) => expandedId !== id)
        : [...prevExpandedIds, id]
    ))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle(id)
    }
  }

  return (
    <div className={`yale-sidebar-accordion ${className}`.trim()}>
      {items.map((item, index) => {
        const isExpanded = expandedIds.includes(item.id)
        const contentId = `accordion-content-${item.id}`

        // 在第一个非 AI 项前添加分隔线（推荐阅读区域）
        const showDivider = index > 0 && items[index - 1]?.id.includes('ai') && !item.id.includes('ai')

        return (
          <div key={item.id}>
            {showDivider && (
              <div className="yale-sidebar-accordion__divider">推荐阅读</div>
            )}
            <div
              className={`yale-sidebar-accordion__item ${isExpanded ? 'yale-sidebar-accordion__item--expanded' : ''}`}
            >
              {/* 项头部 - 可点击 */}
              <div
                className="yale-sidebar-accordion__item-header"
                onClick={() => handleToggle(item.id)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={contentId}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
              >
                <i className={`bi ${item.icon} yale-sidebar-accordion__item-icon`} />
                <span className="yale-sidebar-accordion__item-title">{item.title}</span>
                {item.count !== undefined && (
                  <span className="yale-sidebar-accordion__item-count">{item.count}</span>
                )}
                <i
                  className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} yale-sidebar-accordion__item-toggle`}
                />
              </div>

              {/* 项内容 - 可折叠 */}
              <div
                id={contentId}
                className="yale-sidebar-accordion__item-content"
                style={{ '--content-height': isExpanded ? 'auto' : '0' } as InlineStyleWithVar}
                aria-hidden={!isExpanded}
              >
                {isExpanded && (
                  <div className={['yale-sidebar-accordion__item-body', item.bodyClassName].filter(Boolean).join(' ')}>
                    {item.content()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
