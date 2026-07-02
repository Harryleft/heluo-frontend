import React from 'react'
import { Link } from 'react-router-dom'
import { buildDetailsRouteFromUri } from '@/lib/url/heluoUrl'

interface InternalLinkProps {
  uri: string
  name?: string
  children?: React.ReactNode
}

/**
 * 将外部 URI 转换为内部路由路径
 * 自动识别实体 URI 并转换为本地详情页路由
 *
 * @param uri - 原始 URI
 * @returns 内部路由路径
 */
function convertToInternalRoute(uri: string): string {
  return buildDetailsRouteFromUri(uri) || uri
}

/**
 * 判断 URI 是否为内部可导航的链接
 */
function isInternalNavigable(uri: string): boolean {
  return Boolean(buildDetailsRouteFromUri(uri))
}

/**
 * 内部链接组件，用于应用内部导航
 * 自动将实体 URI 转换为内部路由
 *
 * @param uri - 目标 URI（可以是内部路径或外部 URL）
 * @param name - 链接文本（可选）
 * @param children - 子元素（可选）
 */
const InternalLink: React.FC<InternalLinkProps> = ({ uri, name, children }) => {
  const internalRoute = convertToInternalRoute(uri)

  // 如果是外部链接，使用 <a> 标签
  if (!isInternalNavigable(uri)) {
    return (
      <a
        href={uri}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="external-link"
        className="entity-metadata__link"
      >
        {name}
        {children}
      </a>
    )
  }

  return (
    <Link to={internalRoute} data-testid="internal-link">
      {name}
      {children}
    </Link>
  )
}

export default InternalLink
