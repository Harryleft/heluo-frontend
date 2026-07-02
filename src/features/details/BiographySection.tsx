import React, { useState, useMemo } from 'react'
import type { BiographyData, BiographySource } from '@/lib/parse/data/biographyParser'
import biographySectionStyles from '@/styles/features/details/BiographySection'
import { injectStyles } from '@/lib/dom/injectStyles'

/**
 * 渲染包含 HTML 的文本内容
 * 将文本中的 <a> 标签转换为可点击的链接
 */
function renderHtmlContent(text: string): React.ReactNode {
  if (!text) return null

  // 检查是否包含 HTML 标签
  if (!text.includes('<')) {
    return text
  }

  // 使用正则表达式匹配 <a> 标签
  // 支持 href 属性前后有其他属性，支持 href 使用单引号或双引号
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  // 更健壮的正则：匹配 <a ... href="..." ...>内容</a> 或 <a ... href='...' ...>内容</a>
  const linkPattern = /<a\s+[^>]*?href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi
  let match
  let key = 0

  while ((match = linkPattern.exec(text)) !== null) {
    // 添加链接前的文本
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${key++}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    // 提取链接文本，移除可能存在的嵌套 HTML 标签
    const linkText = match[2].replace(/<[^>]+>/g, '').trim() || match[2]
    // 添加链接
    parts.push(
      <a
        key={`link-${key++}`}
        href={match[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="yale-biography-link"
      >
        {linkText}
      </a>
    )
    lastIndex = match.index + match[0].length
  }

  // 添加最后剩余的文本
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${key++}`}>{text.slice(lastIndex)}</span>)
  }

  return parts.length > 0 ? parts : text
}

/**
 * 检查来源是否有有效内容
 */
function hasValidContent(source: BiographySource): boolean {
  // 检查是否有生卒、字号或介绍
  if (source.birthDeath || source.alias || source.introduction) {
    return true
  }
  // 检查其他字段是否有内容
  if (Object.keys(source.otherFields).length > 0) {
    return true
  }
  // 检查原始内容（需要有一定长度才有意义）
  if (source.rawContent && source.rawContent.length > 20) {
    return true
  }
  return false
}

/**
 * BiographySection 组件属性
 */
interface BiographySectionProps {
  /** 结构化的人物介绍数据 */
  data: BiographyData
  /** 自定义类名 */
  className?: string
}

/**
 * 单个来源块组件
 */
const SourceBlock: React.FC<{ source: BiographySource }> = ({ source }) => {
  return (
    <div className="yale-biography-source">
      {/* 来源标题 */}
      {source.source && (
        <div className="yale-biography-source__header">
          <i className="bi bi-book yale-biography-source__icon" />
          <span className="yale-biography-source__title">{renderHtmlContent(source.source)}</span>
        </div>
      )}

      {/* 字段列表 */}
      <div className="yale-biography-source__fields">
        {/* 生卒年 */}
        {source.birthDeath && (
          <div className="yale-biography-field yale-biography-field--birth-death">
            <span className="yale-biography-field__label">生卒：</span>
            <span className="yale-biography-field__value">{renderHtmlContent(source.birthDeath)}</span>
          </div>
        )}

        {/* 字号 */}
        {source.alias && (
          <div className="yale-biography-field yale-biography-field--alias">
            <span className="yale-biography-field__label">字号：</span>
            <span className="yale-biography-field__value">{renderHtmlContent(source.alias)}</span>
          </div>
        )}

        {/* 介绍 */}
        {source.introduction && (
          <div className="yale-biography-field yale-biography-field--introduction">
            <span className="yale-biography-field__label">介绍</span>
            <p className="yale-biography-field__value">{renderHtmlContent(source.introduction)}</p>
          </div>
        )}

        {/* 其他字段 */}
        {Object.entries(source.otherFields).map(([fieldName, fieldValue]) => (
          <div key={fieldName} className="yale-biography-field">
            <span className="yale-biography-field__label">{fieldName}：</span>
            <p className="yale-biography-field__value">{renderHtmlContent(fieldValue)}</p>
          </div>
        ))}

        {/* 原始内容（回退展示） */}
        {source.rawContent && !source.introduction && (
          <div className="yale-biography-field">
            <p className="yale-biography-field__value">{renderHtmlContent(source.rawContent)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * BiographySection 人物介绍展示组件
 *
 * 用于结构化展示人物介绍信息，支持：
 * - 多个来源的介绍信息
 * - 按字段分类展示（生卒、字号、介绍等）
 * - 无结构化数据时的回退展示
 *
 * @example
 * ```tsx
 * <BiographySection data={biographyData} />
 * ```
 */
export const BiographySection: React.FC<BiographySectionProps> = ({ data, className = '' }) => {
  // 注入样式
  injectStyles('biography-section', biographySectionStyles)

  const [isExpanded, setIsExpanded] = useState(false)

  // 过滤出有有效内容的来源
  const validSources = useMemo(() => {
    return data.sources.filter(hasValidContent)
  }, [data.sources])

  // 无数据时不展示
  if (!data.rawText) {
    return null
  }

  // 无结构化数据时使用简单展示
  if (!data.hasStructuredData) {
    return (
      <div className={`yale-biography-section ${className}`.trim()}>
        <div className="yale-biography-simple">
          <div className="yale-biography-simple__title">
            <i className="bi bi-info-circle" />
            <span>人物介绍</span>
          </div>
          <div className="yale-biography-simple__content">{renderHtmlContent(data.rawText)}</div>
        </div>
      </div>
    )
  }

  // 如果过滤后没有有效来源，回退到简单展示
  if (validSources.length === 0) {
    return (
      <div className={`yale-biography-section ${className}`.trim()}>
        <div className="yale-biography-simple">
          <div className="yale-biography-simple__title">
            <i className="bi bi-info-circle" />
            <span>人物介绍</span>
          </div>
          <div className="yale-biography-simple__content">{renderHtmlContent(data.rawText)}</div>
        </div>
      </div>
    )
  }

  // 只有一个有效来源时直接展示
  if (validSources.length === 1) {
    return (
      <div className={`yale-biography-section ${className}`.trim()}>
        <SourceBlock source={validSources[0]} />
      </div>
    )
  }

  // 多个有效来源时支持折叠
  const visibleSources = isExpanded ? validSources : validSources.slice(0, 1)
  const hasMoreSources = validSources.length > 1

  return (
    <div className={`yale-biography-section ${className}`.trim()}>
      {visibleSources.map((source, index) => (
        <SourceBlock key={index} source={source} />
      ))}

      {/* 展开/收起按钮 */}
      {hasMoreSources && (
        <button
          className={`yale-biography-toggle ${isExpanded ? 'yale-biography-toggle--expanded' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <span>{isExpanded ? '收起其他来源' : `查看其他 ${validSources.length - 1} 个来源`}</span>
          <i className="bi bi-chevron-down yale-biography-toggle__icon" />
        </button>
      )}
    </div>
  )
}
