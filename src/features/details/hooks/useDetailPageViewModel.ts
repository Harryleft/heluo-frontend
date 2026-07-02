/**
 * 详情页视图模型 Hook
 *
 * 统一详情页状态与数据组装，聚合：
 * - URL 参数解析
 * - 详情数据加载
 * - 内部链接丰富化
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDetailData, type UseDetailDataReturn } from '@/features/details/hooks/useDetailData'
import { useEnrichLinks, type EnrichedInternalLink } from '@/features/details/hooks/useEnrichLinks'
import { parseUriResource } from '@/features/details/utils/uriParser'

// ============================================================================
// 常量定义
// ============================================================================

const EMPTY_PARAM_VALUE = ''

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 详情页聚合视图模型
 */
export interface DetailPageViewModel extends UseDetailDataReturn {
  uri: string
  query: string
  enrichedLinks: EnrichedInternalLink[]
}

// ============================================================================
// 私有实现
// ============================================================================

function readQueryParam(params: globalThis.URLSearchParams, key: string): string {
  return params.get(key) || EMPTY_PARAM_VALUE
}

function getInternalLinks(data: UseDetailDataReturn['data']) {
  return data?.internalLinks || []
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 统一详情页状态与数据组装 Hook
 */
export function useDetailPageViewModel(): DetailPageViewModel {
  const [params] = useSearchParams()
  const uri = readQueryParam(params, 'uri')
  const query = readQueryParam(params, 'q')
  const resourceType = parseUriResource(uri).type

  const detailData = useDetailData(uri, query)
  const enrichLinks = useEnrichLinks(query)
  const [enrichedLinks, setEnrichedLinks] = useState<EnrichedInternalLink[]>([])

  useEffect(() => {
    if (resourceType === 'book') {
      setEnrichedLinks([])
      return
    }

    const internalLinks = getInternalLinks(detailData.data)
    if (!internalLinks.length) {
      setEnrichedLinks([])
      return
    }

    let active = true
    enrichLinks(internalLinks)
      .then((enriched) => {
        if (active) {
          setEnrichedLinks(enriched)
        }
      })
      .catch(() => {
        if (active) {
          setEnrichedLinks([])
        }
      })

    return () => {
      active = false
    }
  }, [detailData.data, enrichLinks, resourceType])

  return {
    ...detailData,
    uri,
    query,
    enrichedLinks,
  }
}
