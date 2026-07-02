/**
 * 渲染诗文详情卡片。
 */

import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import poemDetailCardStyles from '@/styles/features/details/PoemDetailCard'
import type { PoemDetailViewModel } from '@/types/api'
import { injectStyles } from '@/lib/dom/injectStyles'
import { normalizeText } from '@/lib/utils/text'

const TEST_ID = 'poem-detail-card'
const DEFAULT_TITLE = '无标题'
const DEFAULT_AUTHOR = '未知作者'
const DEFAULT_EMPTY_TEXT = '未检索到诗文全文'
const DEFAULT_EMPTY_PLACE = '暂无地理信息'

interface PoemDetailCardProps {
  poemDetail: PoemDetailViewModel
  creationTime?: string
  className?: string
}

interface _PlaceLinkItem {
  label: string
  uri: string
}

export const PoemDetailCard: React.FC<PoemDetailCardProps> = ({
  poemDetail,
  creationTime = '',
  className = '',
}) => {
  // 注入样式
  injectStyles('poem-detail-card', poemDetailCardStyles)

  const { title, author, authorId, fullText, dynasty, genre, genreUri, rhyme, rhymeUri, comments } = poemDetail
  const relatedPlaces = useMemo(() => _normalizePlaces(poemDetail.relatedPlaces), [poemDetail.relatedPlaces])
  const hasFullText = Boolean(fullText)
  const hasComments = Array.isArray(comments) && comments.length > 0

  return (
    <article className={`poem-detail-card ${className}`.trim()} data-testid={TEST_ID}>
      <div className="poem-detail-card__inner">
        <div className="poem-detail-card__header">
          <div className="poem-detail-card__title-section">
            {dynasty && (
              <div className="poem-detail-card__tags">
                <span className="poem-detail-card__tag">{dynasty}</span>
              </div>
            )}
            <h2 className="poem-detail-card__title">{title || DEFAULT_TITLE}</h2>
          </div>
        </div>

        <section className="poem-detail-card__section">
          <h3 className="poem-detail-card__section-title">正文</h3>
          {hasFullText ? (
            <div className="poem-detail-card__content-wrapper">
              <pre className="poem-detail-card__content">{fullText}</pre>
            </div>
          ) : (
            <p className="poem-detail-card__empty">{DEFAULT_EMPTY_TEXT}</p>
          )}
        </section>

        {hasComments && (
          <section className="poem-detail-card__section poem-detail-card__section--annotations">
            <h3 className="poem-detail-card__annotations-title">校注</h3>
            <ul className="poem-detail-card__annotations-list">
              {comments.map((item, index) => (
                <li key={index} className="poem-detail-card__annotation-item">
                  {item.text && (
                    <span className="poem-detail-card__annotation-text">{item.text}</span>
                  )}
                  <span className="poem-detail-card__annotation-comment">{item.comment}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="poem-detail-card__section poem-detail-card__section--fields">
          <div className="poem-detail-card__field-grid">
            <div className="poem-detail-card__field">
              <span className="poem-detail-card__field-key">作品名称</span>
              <span className="poem-detail-card__field-value">{title || DEFAULT_TITLE}</span>
            </div>
            <div className="poem-detail-card__field">
              <span className="poem-detail-card__field-key">作者</span>
              <span className="poem-detail-card__field-value">{_renderPersonFieldLink(author, authorId)}</span>
            </div>
            <div className="poem-detail-card__field">
              <span className="poem-detail-card__field-key">创作年代</span>
              <span className="poem-detail-card__field-value">{creationTime || '未知'}</span>
            </div>
            <div className="poem-detail-card__field">
              <span className="poem-detail-card__field-key">体裁</span>
              <span className="poem-detail-card__field-value">{_renderDetailFieldLink(genre, genreUri)}</span>
            </div>
            <div className="poem-detail-card__field">
              <span className="poem-detail-card__field-key">韵目</span>
              <span className="poem-detail-card__field-value">{_renderDetailFieldLink(rhyme, rhymeUri)}</span>
            </div>
            <div className="poem-detail-card__field poem-detail-card__field--full">
              <span className="poem-detail-card__field-key">创作地点</span>
              <span className="poem-detail-card__field-value">{_renderPlaceLinks(relatedPlaces)}</span>
            </div>
          </div>
        </section>

        {relatedPlaces.length > 0 && (
          <section className="poem-detail-card__geo">
            <h3 className="poem-detail-card__geo-title">地理脉络</h3>
            <div className="poem-detail-card__map-canvas" aria-label="诗文地理地图容器" />
            <p className="poem-detail-card__map-status">
              关联地点：{relatedPlaces.map((item) => item.label).join('、')}
            </p>
          </section>
        )}
      </div>
    </article>
  )
}

function _renderDetailFieldLink(label?: string, uri?: string): React.ReactNode {
  const text = normalizeText(label) || '未知'
  const href = _buildDetailHref(uri)
  if (!href || !label) return text

  return (
    <Link to={href} className="poem-detail-card__field-link">
      {text}
    </Link>
  )
}

function _renderPersonFieldLink(label?: string, personId?: string): React.ReactNode {
  const text = normalizeText(label) || DEFAULT_AUTHOR
  const href = _buildPersonDetailHref(personId)
  if (!href || !label) return text

  return (
    <Link to={href} className="poem-detail-card__field-link">
      {text}
    </Link>
  )
}

function _buildDetailHref(uri?: string): string {
  const normalizedUri = normalizeText(uri)
  if (!normalizedUri) return ''
  return `/details?uri=${encodeURIComponent(normalizedUri)}`
}

function _buildPersonDetailHref(personId?: string): string {
  const normalizedId = normalizeText(personId)
  if (!normalizedId) return ''
  return _buildDetailHref(`/person/${normalizedId}`)
}

function _normalizePlaces(places: PoemDetailViewModel['relatedPlaces']): _PlaceLinkItem[] {
  if (!Array.isArray(places)) return []

  const seen = new Set<string>()
  const result: _PlaceLinkItem[] = []
  places.forEach((item) => {
    const label = normalizeText(item?.label)
    const uri = normalizeText(item?.uri)
    const key = uri || label
    if (!label || !key || seen.has(key)) return
    seen.add(key)
    result.push({ label, uri })
  })

  return result
}

/**
 * 渲染地点链接列表
 * 如果地点有 URI，则渲染为可点击链接；否则渲染为纯文本
 */
function _renderPlaceLinks(places: _PlaceLinkItem[]): React.ReactNode {
  if (!places.length) return DEFAULT_EMPTY_PLACE

  return places.map((place, index) => (
    <React.Fragment key={place.uri || place.label}>
      {place.uri ? (
        <Link to={`/details?uri=${encodeURIComponent(place.uri)}`} className="poem-detail-card__field-link">
          {place.label}
        </Link>
      ) : (
        place.label
      )}
      {index < places.length - 1 && '、'}
    </React.Fragment>
  ))
}
