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
import { Link, useLocation, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: '首页', match: (pathname: string) => pathname === '/' },
  { to: '/topics/dufu-from-gongxian', label: '人物专题', match: (pathname: string) => pathname.startsWith('/topics/') },
  { to: '/chat', label: '智能对话', match: (pathname: string) => pathname === '/chat' },
] as const

/**
 * 判断是否应该显示全局 Header
 */
export function shouldShowGlobalHeader(pathname: string): boolean {
  return pathname !== '/mirador'
}

/**
 * 全局导航头部组件
 */
export function GlobalHeader(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
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

        <nav className="global-header-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <Link
              className={`global-header-nav-item${item.match(location.pathname) ? ' is-active' : ''}`}
              key={item.to}
              to={item.to}
            >
              <span className="global-header-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

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
