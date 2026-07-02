/**
 * 详情页路由分发器
 *
 * 根据 URI 参数中的资源类型，分发到对应的专用页面组件：
 * - /poem/* -> PoemDetailsPage
 * - /person/* -> PersonDetailsPage
 * - /book/* -> BookDetailsPage
 * - /ancient-book/* -> AncientBookDetailsPage
 * - /place/* -> PlaceDetailsPage
 * - /concept/* -> ConceptDetailsPage
 * - 其他 -> UnknownDetailsPage
 */

import { useSearchParams } from 'react-router-dom'
import { parseUriResource } from '@/features/details/utils/uriParser'
import { PoemDetailsPage } from '@/features/details/pages/PoemDetailsPage'
import { PersonDetailsPage } from '@/features/details/pages/PersonDetailsPage'
import { BookDetailsPage } from '@/features/details/pages/BookDetailsPage'
import { AncientBookDetailsPage } from '@/features/details/pages/AncientBookDetailsPage'
import { PlaceDetailsPage } from '@/features/details/pages/PlaceDetailsPage'
import { ConceptDetailsPage } from '@/features/details/pages/ConceptDetailsPage'
import { UnknownDetailsPage } from '@/features/details/pages/UnknownDetailsPage'
import type { DetailResourceType } from '@/features/details/utils/uriParser'

// ============================================================================
// 常量定义
// ============================================================================

const URI_PARAM_KEY = 'uri'
const EMPTY_URI = ''

// ============================================================================
// 私有实现
// ============================================================================

function readUriParam(params: globalThis.URLSearchParams): string {
  return params.get(URI_PARAM_KEY) || EMPTY_URI
}

function renderDetailsPageByType(type: DetailResourceType): JSX.Element {
  switch (type) {
    case 'poem':
      return <PoemDetailsPage />
    case 'person':
      return <PersonDetailsPage />
    case 'book':
      return <BookDetailsPage />
    case 'ancient_book':
      return <AncientBookDetailsPage />
    case 'place':
      return <PlaceDetailsPage />
    case 'concept':
      return <ConceptDetailsPage />
    default:
      return <UnknownDetailsPage />
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 详情页路由分发器组件
 *
 * @example
 * ```tsx
 * // 在 App.tsx 中使用
 * <Route path="/details" element={<DetailsRouter />} />
 * ```
 */
export function DetailsRouter(): JSX.Element {
  const [params] = useSearchParams()
  const uri = readUriParam(params)

  const resource = parseUriResource(uri)
  return renderDetailsPageByType(resource.type)
}
