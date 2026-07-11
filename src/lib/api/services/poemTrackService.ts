/**
 * 人物诗文轨迹 API 服务
 *
 * 提供 /api/v1/persons/:id/poem-track 接口的调用方法
 */

import { http } from '@/lib/api/http'
import { FRONTEND_CACHE_CONFIG, FRONTEND_CACHE_VERSION } from '@/lib/cache/cacheConfig'
import { createUnifiedCache } from '@/lib/cache/unifiedCache'
import { isPersonPoemTrack } from '@/lib/api/contracts/personPoemTrackContract'
import type {
  PersonPoemTrackApiResult,
} from '@/types/contracts/poemTrackContracts'

// ============================================================================
// 常量定义
// ============================================================================

/** API 端点基础路径 */
const POEM_TRACK_BASE_PATH = '/api/v1/persons'

const poemTrackCache = createUnifiedCache<PersonPoemTrackApiResult>(FRONTEND_CACHE_CONFIG.poemTrack.namespace, {
  ttlMs: FRONTEND_CACHE_CONFIG.poemTrack.ttlMs,
  maxEntries: FRONTEND_CACHE_CONFIG.poemTrack.maxEntries,
  version: FRONTEND_CACHE_VERSION,
})

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 获取人物诗文地理轨迹数据
 *
 * @param personId - 人物 ID
 * @returns 轨迹数据 API 响应
 *
 * @example
 * ```typescript
 * const result = await fetchPersonPoemTrack('17270')
 * if (result.success) {
 *   console.log(result.data.personName) // '杜甫'
 *   console.log(result.data.trackPoints.length)
 * }
 * ```
 */
export async function fetchPersonPoemTrack(
  personId: string,
): Promise<PersonPoemTrackApiResult> {
  if (!personId || typeof personId !== 'string') {
    return {
      success: false,
      error: {
        code: 'INVALID_PARAMS',
        message: '人物 ID 不能为空',
        statusCode: 400,
      },
    }
  }

  try {
    const trimmedPersonId = personId.trim()
    const cacheKey = trimmedPersonId
    const cached = poemTrackCache.get(cacheKey)
    if (cached) {
      return cached
    }

    const url = `${POEM_TRACK_BASE_PATH}/${encodeURIComponent(trimmedPersonId)}/poem-track`

    const response = await http.get<PersonPoemTrackApiResult>(url)
    if (response.data?.success) {
      if (!isPersonPoemTrack(response.data.data)) {
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '诗文轨迹数据格式无效',
            statusCode: 502,
          },
        }
      }
      poemTrackCache.set(cacheKey, response.data)
    }

    // 后端已返回正确的 API 响应格式，直接返回
    return response.data
  } catch (error) {
    // 仅识别显式取消；Axios 超时使用 ECONNABORTED，应作为请求失败处理。
    const axiosError = error as unknown as { name?: string; code?: string }
    if (axiosError?.name === 'CanceledError' || axiosError?.code === 'ERR_CANCELED') {
      // 请求被取消，返回一个特殊的错误对象，让调用方知道这不是真正的错误
      return {
        success: false,
        error: {
          code: 'REQUEST_CANCELED',
          message: '请求已取消',
          statusCode: 499, // Client Closed Request
        },
      }
    }

    // 网络错误或其他异常
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取诗文轨迹数据失败，请稍后重试',
        statusCode: 500,
      },
    }
  }
}
