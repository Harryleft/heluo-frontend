import { useSearchParams, Link } from 'react-router-dom'

/**
 * UnknownDetailsPage 未知类型回退页面
 *
 * 当 URI 无法识别为诗文或人物时显示此页面
 *
 * @example
 * ```tsx
 * <UnknownDetailsPage />
 * ```
 */
export function UnknownDetailsPage(): JSX.Element {
  const [params] = useSearchParams()
  const uri = params.get('uri') || ''

  return (
    <main className="container">
      <section className="panel">
        <h1>未知资源类型</h1>
        <p className="muted">
          无法识别的资源 URI：<code>{uri || '(空)'}</code>
        </p>
        <p style={{ marginTop: '1rem' }}>
          当前支持的资源类型：
        </p>
        <ul>
          <li>
            <strong>诗文</strong>：包含 <code>/poem/set/</code> 或 <code>/poem/text/</code> 的 URI
          </li>
          <li>
            <strong>人物</strong>：包含 <code>/person/</code> 的 URI
          </li>
        </ul>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/" className="button">
            返回首页
          </Link>
        </p>
      </section>
    </main>
  )
}
