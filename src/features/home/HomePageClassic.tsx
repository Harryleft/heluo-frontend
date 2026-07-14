/**
 * HomePageClassic.tsx
 * 经典学术风格首页 - 河洛历史名人知识发现平台
 *
 * 设计理念：
 * - 历史文化质感，营造典雅的学术氛围
 * - 优雅的排版层次，信息清晰易读
 * - 温暖的配色方案，体现历史厚重感
 * - 精致的装饰元素，细节处彰显品质
 */

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { fetchEntityCounts } from '@/lib/api/v1Api'
import { STATS_CARDS } from '@/resources/statsCards'

const DEFAULT_SCOPE = 'all'
const EMPTY_COUNTS: Record<string, number> = {}

/**
 * 构建搜索结果页路径
 */
function buildResultsPath(rawQuery: string, scope: string): string {
  const query = rawQuery.trim()
  const params = new globalThis.URLSearchParams({ scope })
  if (query) {
    params.set('q', query)
  }
  return `/results?${params.toString()}`
}

/**
 * 格式化数值显示（添加千位分隔符）
 */
function formatCountValue(value: number): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

/**
 * 经典学术风格首页组件
 */
export function HomePageClassic(): JSX.Element {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>(EMPTY_COUNTS)

  // 获取统计数据
  useEffect(() => {
    let active = true
    fetchEntityCounts()
      .then((data) => {
        if (active) {
          setCounts(data)
        }
      })
      .catch(() => {
        if (active) {
          setCounts(EMPTY_COUNTS)
        }
      })

    return () => {
      active = false
    }
  }, [])

  // 处理搜索提交
  function handleSearchSubmit(event: FormEvent<globalThis.HTMLFormElement>): void {
    event.preventDefault()
    navigate(buildResultsPath(query, DEFAULT_SCOPE))
  }

  // 处理卡片点击
  function handleCardClick(scope: string): void {
    navigate(buildResultsPath(query, scope))
  }

  return (
    <main className="classic-homepage">
      {/* 首屏：Hero + 典藏概览 */}
      <div className="classic-hero-above">
        {/* Hero 区域 */}
        <section className="classic-hero">
          {/* 标题区域 */}
          <div className="classic-title-section">
            {/* 副标题 */}
            <p className="classic-subtitle">探索千年河洛文明</p>

            {/* 主标题 */}
            <h1 className="classic-main-title">
              <span className="classic-title-char">河</span>
              <span className="classic-title-char">洛</span>
              <span className="classic-title-char">历</span>
              <span className="classic-title-char">史</span>
              <span className="classic-title-char">名</span>
              <span className="classic-title-char">人</span>
              <span className="classic-title-divider">·</span>
              <span className="classic-title-char">知</span>
              <span className="classic-title-char">识</span>
              <span className="classic-title-char">发</span>
              <span className="classic-title-char">现</span>
              <span className="classic-title-char">平</span>
              <span className="classic-title-char">台</span>
            </h1>

            {/* 装饰性分隔线 */}
            <div className="classic-divider">
              <span className="classic-divider-line" />
              <span className="classic-divider-ornament">✦</span>
              <span className="classic-divider-line" />
            </div>

            {/* 标题描述 */}
            <p className="classic-description">
              深入挖掘河洛地区历史人物、诗词文献、古籍典藏，<br />
              感受中原文化的深厚底蕴
            </p>
          </div>

          {/* 搜索区域 */}
          <div className="classic-search-section">
            <form className="classic-search-form" onSubmit={handleSearchSubmit}>
              <div className="classic-search-wrapper">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索人物、诗词、古籍、地点..."
                  className="classic-search-input"
                />
                <button type="submit" className="classic-search-button" aria-label="搜索">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="16.5" y1="16.5" x2="21" y2="21" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </form>
          </div>

        </section>

        <section className="classic-featured-topic" aria-labelledby="featured-topic-title">
          <div className="classic-featured-topic-meta">
            <span>人物专题 · 第一期</span>
            <span>从河洛出发</span>
          </div>
          <div className="classic-featured-topic-content">
            <div>
              <p className="classic-featured-topic-kicker">本期策展</p>
              <h2 id="featured-topic-title">杜甫：从巩县出发的诗史人生</h2>
              <p>沿着地点、诗歌与文献，把分散的知识重新连成一条可阅读的生命路径。</p>
            </div>
            <Link className="classic-featured-topic-link" to="/topics/dufu-from-gongxian">
              进入专题
            </Link>
          </div>
          <div className="classic-featured-topic-facts" aria-label="杜甫专题资料概览">
            <span><strong>46</strong> 种传记资料</span>
            <span><strong>1,289</strong> 篇诗文</span>
            <span><strong>1,270</strong> 条地点关联</span>
          </div>
        </section>

        {/* 数据统计区域 */}
        <section className="classic-stats-section">
          <div className="classic-stats-header">
            <h2 className="classic-stats-title">典藏概览</h2>
            <div className="classic-stats-subtitle">Collection Overview</div>
          </div>

          <div className="classic-stats-grid">
            {STATS_CARDS.map((card, index) => (
              <Link
                key={card.key}
                className="classic-stat-card"
                to={buildResultsPath(query, card.scope)}
                onClick={(e) => {
                  e.preventDefault()
                  handleCardClick(card.scope)
                }}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* 卡片装饰 */}
                <div className="classic-card-corner classic-card-corner-tl" />
                <div className="classic-card-corner classic-card-corner-tr" />
                <div className="classic-card-corner classic-card-corner-bl" />
                <div className="classic-card-corner classic-card-corner-br" />

                {/* 卡片图标 */}
                <div className="classic-card-icon" data-icon={card.key}>
                  {getCardIcon(card.key)}
                </div>

                {/* 卡片标签 */}
                <div className="classic-card-label">{card.label}</div>

                {/* 卡片数值 */}
                <div className="classic-card-value">{formatCountValue(counts[card.key] || 0)}</div>

                {/* 卡片装饰线 */}
                <div className="classic-card-underline" />
              </Link>
            ))}
          </div>
        </section>

        {/* AI 对话引导区域 */}
        <section className="classic-chat-guide">
          <div className="classic-chat-guide-header">
            <div className="classic-chat-guide-ornament">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10L12 2Z" />
              </svg>
            </div>
            <h2 className="classic-chat-guide-title">智能对话助手</h2>
            <p className="classic-chat-guide-subtitle">AI-Powered Dialogue</p>
            <p className="classic-chat-guide-desc">
              基于河洛典藏数据，以自然语言交互方式探索历史人物、诗词文献与地理文化
            </p>
          </div>

          <div className="classic-chat-guide-features">
            <div className="classic-chat-feature">
              <div className="classic-chat-feature-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21L16 16" />
                </svg>
              </div>
              <div className="classic-chat-feature-label">智能检索</div>
              <div className="classic-chat-feature-desc">跨实体关联查询</div>
            </div>
            <div className="classic-chat-feature">
              <div className="classic-chat-feature-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </div>
              <div className="classic-chat-feature-label">知识问答</div>
              <div className="classic-chat-feature-desc">自然语言交互</div>
            </div>
            <div className="classic-chat-feature">
              <div className="classic-chat-feature-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                </svg>
              </div>
              <div className="classic-chat-feature-label">文献溯源</div>
              <div className="classic-chat-feature-desc">引用来源追踪</div>
            </div>
          </div>

          <div className="classic-chat-guide-action">
            <Link className="classic-chat-guide-btn" to="/chat">
              <span className="classic-chat-guide-btn-text">开始对话</span>
              <svg className="classic-chat-guide-btn-arrow" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>
      </div>

      {/* 页脚装饰 */}
      <footer className="classic-footer">
        <div className="classic-footer-text">
          <span>河洛文化</span>
          <span className="classic-footer-separator">·</span>
          <span>源远流长</span>
        </div>
      </footer>
    </main>
  )
}

/**
 * 获取卡片图标
 */
function getCardIcon(key: string): JSX.Element {
  switch (key) {
    case 'person':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 19c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5" />
        </svg>
      )
    case 'poemSet':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5.5h10M7 10h10M7 14.5h6.5" />
          <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
        </svg>
      )
    case 'book':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 5.5h9.5a2.5 2.5 0 0 1 2.5 2.5v10.5H8.2A2.2 2.2 0 0 0 6 20.7V5.5Z" />
          <path d="M6 5.5v15.2M18 18.5v-13" />
        </svg>
      )
    case 'ancientBook':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="6" width="6.8" height="12" rx="1.5" />
          <rect x="13.2" y="6" width="6.8" height="12" rx="1.5" />
          <path d="M10.8 8h2.4M10.8 12h2.4M10.8 16h2.4" />
        </svg>
      )
    case 'geography':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s5.5-5.2 5.5-9.3A5.5 5.5 0 1 0 6.5 11.7C6.5 15.8 12 21 12 21Z" />
          <circle cx="12" cy="11" r="2.2" />
        </svg>
      )
    case 'concept':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4.5a5.5 5.5 0 0 0-3.6 9.7c.6.5 1 1.2 1 2h5.2c0-.8.4-1.5 1-2A5.5 5.5 0 0 0 12 4.5Z" />
          <path d="M10 19h4M10.5 21h3" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="4.5" width="14" height="15" rx="2" />
          <path d="M8.5 9h7M8.5 13h7" />
        </svg>
      )
  }
}
