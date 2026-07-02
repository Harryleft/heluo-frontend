/**
 * GlobalHeader.tsx
 * 全局导航头部组件
 *
 * 设计理念：
 * - 经典学术风格，与首页 Hero 呼应
 * - 简洁的导航链接
 * - 支持 Active 状态高亮
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/**
 * 判断是否应该显示全局 Header
 * 当前全站都显示 Header
 */
export function shouldShowGlobalHeader(_pathname: string): boolean {
  return true
}

/**
 * 全局导航头部组件
 */
export function GlobalHeader(): JSX.Element {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSearchSubmit(event: FormEvent<globalThis.HTMLFormElement>): void {
    event.preventDefault()
    const keyword = query.trim()
    const params = new globalThis.URLSearchParams({ scope: 'all' })
    if (keyword) {
      params.set('q', keyword)
    }
    navigate(`/results?${params.toString()}`)
  }

  return (
    <header className="global-header">
      <div className="global-header-inner">
        <Link to="/" className="global-header-logo" aria-label="返回首页">
          <svg
            className="global-header-logo-mark"
            viewBox="0 0 36 36"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-hidden="true"
          >
            <rect x="2.5" y="2.5" width="31" height="31" rx="7" className="global-header-logo-bg" />
            <path d="M9 13.5h18M9 22.5h18M18 9v18" className="global-header-logo-path" />
          </svg>
        </Link>

        <nav className="global-header-nav" aria-label="主导航" />

        <form className="global-header-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="global-header-search-input" className="global-header-search-label">
            站内搜索
          </label>
          <input
            id="global-header-search-input"
            className="global-header-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索人物、诗文、地理..."
          />
          <button type="submit" className="global-header-search-button">
            搜索
          </button>
        </form>
      </div>
    </header>
  )
}
