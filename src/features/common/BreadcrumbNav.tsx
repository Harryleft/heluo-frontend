import { Link, useLocation } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  to?: string
}

const PATH_LABEL_MAP: Record<string, string> = {
  results: '检索结果',
  chat: '智能对话',
  details: '详情',
  iiif: 'IIIF 阅览',
  mirador: 'Mirador 阅览',
}

const DETAIL_TYPE_LABEL_MAP: Record<string, string> = {
  person: '人物',
  poem: '诗文',
  place: '地理',
  ancient_book: '古籍',
  book: '图书',
  concept: '概念',
}

function parseDetailTypeFromUri(rawUri: string): string {
  const uri = rawUri.toLowerCase()
  if (uri.includes('/person/')) return 'person'
  if (uri.includes('/poem/')) return 'poem'
  if (uri.includes('/place/')) return 'place'
  if (uri.includes('/ancient-book/')) return 'ancient_book'
  if (uri.includes('/book/')) return 'book'
  if (uri.includes('/concept/')) return 'concept'
  return ''
}

function buildBreadcrumbItems(pathname: string, search: string): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: '首页', to: '/' }]
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return items
  }

  let pathAccumulator = ''
  segments.forEach((segment, index) => {
    pathAccumulator += `/${segment}`
    const isLast = index === segments.length - 1
    const label = PATH_LABEL_MAP[segment] || segment
    items.push({
      label,
      to: isLast ? undefined : pathAccumulator,
    })
  })

  if (pathname === '/details') {
    const params = new globalThis.URLSearchParams(search)
    const detailType = parseDetailTypeFromUri(params.get('uri') || '')
    if (detailType && DETAIL_TYPE_LABEL_MAP[detailType]) {
      items.push({ label: DETAIL_TYPE_LABEL_MAP[detailType] })
    }
  }

  return items
}

export function BreadcrumbNav(): JSX.Element | null {
  const location = useLocation()
  if (location.pathname === '/') {
    return null
  }

  const items = buildBreadcrumbItems(location.pathname, location.search)
  return (
    <nav className="global-breadcrumb" aria-label="面包屑导航">
      <ol className="global-breadcrumb-list">
        {items.map((item, index) => {
          const key = `${item.label}-${index}`
          const isLast = index === items.length - 1
          return (
            <li
              key={key}
              className={`global-breadcrumb-item ${isLast ? 'is-current' : ''}`}
              aria-current={isLast ? 'page' : undefined}
            >
              {item.to ? (
                <Link to={item.to} className="global-breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
