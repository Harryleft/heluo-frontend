/**
 * AI 服务 Hooks
 *
 * 封装人物 AI 介绍、诗文 AI 赏析的请求、缓存和状态管理。
 * 每个Hook包含 loading/success/error 三态、缓存读写、主动刷新能力。
 *
 * @module details/hooks/useAiServices
 */

import { useEffect, useState, useCallback } from 'react'

import { http } from '@/providers/apiClient'
import { FRONTEND_CACHE_CONFIG, FRONTEND_CACHE_VERSION } from '@/lib/cache/cacheConfig'
import { createUnifiedCache } from '@/lib/cache/unifiedCache'
import {
  AI_INTRO_EMPTY_MESSAGE,
  AI_INTRO_FALLBACK_ERROR_MESSAGE,
  PERSON_AI_INTRO_ENDPOINT,
  POEM_AI_ANALYSIS_EMPTY_MESSAGE,
  POEM_AI_ANALYSIS_FALLBACK_ERROR_MESSAGE,
  POEM_AI_ANALYSIS_ENDPOINT,
} from '@/features/details/constants/overviewConstants'

// ============================================================================
// 缓存实例（模块级，跨组件实例共享）
// ============================================================================

const personAiIntroCache = createUnifiedCache<string>(FRONTEND_CACHE_CONFIG.personAiIntro.namespace, {
  ttlMs: FRONTEND_CACHE_CONFIG.personAiIntro.ttlMs,
  maxEntries: FRONTEND_CACHE_CONFIG.personAiIntro.maxEntries,
  version: FRONTEND_CACHE_VERSION,
})

const poemAiAnalysisCache = createUnifiedCache<string>(FRONTEND_CACHE_CONFIG.poemAiAnalysis.namespace, {
  ttlMs: FRONTEND_CACHE_CONFIG.poemAiAnalysis.ttlMs,
  maxEntries: FRONTEND_CACHE_CONFIG.poemAiAnalysis.maxEntries,
  version: FRONTEND_CACHE_VERSION,
})

// ============================================================================
// 缓存键构建
// ============================================================================

function buildPersonAiIntroCacheKey(personName: string, referredContents: string[]): string {
  return JSON.stringify({
    personName: String(personName || '').trim(),
    referredContents: Array.isArray(referredContents) ? referredContents : [],
  })
}

function buildPoemAiAnalysisCacheKey(payload: {
  title: string
  author: string
  dynasty: string
  fullText: string
  background: string
  creationTime: string
  geoContext: string
}): string {
  return JSON.stringify({
    title: String(payload.title || '').trim(),
    author: String(payload.author || '').trim(),
    dynasty: String(payload.dynasty || '').trim(),
    fullText: String(payload.fullText || '').trim(),
    background: String(payload.background || '').trim(),
    creationTime: String(payload.creationTime || '').trim(),
    geoContext: String(payload.geoContext || '').trim(),
  })
}

// ============================================================================
// 请求函数
// ============================================================================

function requestPersonAiIntro(name: string, referredContents: string[]): Promise<string> {
  return http.post(PERSON_AI_INTRO_ENDPOINT, { name, referredContents })
    .then((response) => {
      const introText = extractPersonAiIntro(response?.data)
      if (!introText) {
        throw new Error(AI_INTRO_EMPTY_MESSAGE)
      }
      return introText
    })
}

function requestPoemAiAnalysis(payload: {
  title: string
  author: string
  dynasty: string
  fullText: string
  background: string
  creationTime: string
  geoContext: string
}): Promise<string> {
  return http.post(POEM_AI_ANALYSIS_ENDPOINT, payload)
    .then((response) => {
      const analysisText = extractPoemAiAnalysis(response?.data)
      if (!analysisText) {
        throw new Error(POEM_AI_ANALYSIS_EMPTY_MESSAGE)
      }
      return analysisText
    })
}

function extractPoemAiAnalysis(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const dataRecord = payload as Record<string, unknown>
  const dataNode = dataRecord.data && typeof dataRecord.data === 'object'
    ? dataRecord.data as Record<string, unknown>
    : dataRecord
  return String(dataNode.analysis || '').trim()
}

function extractPersonAiIntro(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const dataRecord = payload as Record<string, unknown>
  const dataNode = dataRecord.data && typeof dataRecord.data === 'object'
    ? dataRecord.data as Record<string, unknown>
    : dataRecord
  return String(dataNode.intro || '').trim()
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '').trim()
    if (message) return message
  }
  return fallback
}

// ============================================================================
// 类型
// ============================================================================

export type AiServiceState = 'idle' | 'loading' | 'success' | 'error'

export interface UsePersonAiIntroResult {
  aiIntro: string
  aiIntroState: AiServiceState
  aiIntroError: string
  refreshAiIntro: () => void
}

export interface UsePoemAiAnalysisResult {
  poemAiAnalysis: string
  poemAiAnalysisState: AiServiceState
  poemAiAnalysisError: string
  refreshPoemAiAnalysis: () => void
}

// ============================================================================
// usePersonAiIntro
// ============================================================================

/**
 * 人物 AI 介绍 Hook
 *
 * @param enabled - 是否启用（isPersonResource）
 * @param personName - 人物名称
 * @param referredContents - 人物引用内容数组
 * @returns AI 介绍文本、状态、错误信息、手动刷新函数
 */
export function usePersonAiIntro(
  enabled: boolean,
  personName: string,
  referredContents: string[],
): UsePersonAiIntroResult {
  const [aiIntro, setAiIntro] = useState('')
  const [aiIntroState, setAiIntroState] = useState<AiServiceState>('idle')
  const [aiIntroError, setAiIntroError] = useState('')

  const _referredContentsKey = referredContents.join('\n')

  useEffect(() => {
    if (!enabled) return
    if (!referredContents.length) {
      setAiIntro('')
      setAiIntroState('idle')
      setAiIntroError('')
      return
    }

    let active = true
    const cacheKey = buildPersonAiIntroCacheKey(personName, referredContents)
    const cachedIntro = personAiIntroCache.get(cacheKey)
    if (cachedIntro) {
      setAiIntro(cachedIntro)
      setAiIntroState('success')
      setAiIntroError('')
      return () => { active = false }
    }

    setAiIntroState('loading')
    setAiIntroError('')

    requestPersonAiIntro(personName, referredContents)
      .then((introText) => {
        if (!active) return
        if (introText) {
          personAiIntroCache.set(cacheKey, introText)
        }
        setAiIntro(introText)
        setAiIntroState('success')
      })
      .catch((error) => {
        if (!active) return
        setAiIntro('')
        setAiIntroState('error')
        setAiIntroError(resolveErrorMessage(error, AI_INTRO_FALLBACK_ERROR_MESSAGE))
      })

    return () => { active = false }
  }, [enabled, personName, referredContents])

  const refreshAiIntro = useCallback(() => {
    if (!enabled || !referredContents.length) return

    const cacheKey = buildPersonAiIntroCacheKey(personName, referredContents)
    setAiIntroState('loading')
    setAiIntro('')
    setAiIntroError('')

    requestPersonAiIntro(personName, referredContents)
      .then((introText) => {
        if (introText) {
          personAiIntroCache.set(cacheKey, introText)
        }
        setAiIntro(introText)
        setAiIntroState('success')
      })
      .catch((error) => {
        setAiIntro('')
        setAiIntroState('error')
        setAiIntroError(resolveErrorMessage(error, AI_INTRO_FALLBACK_ERROR_MESSAGE))
      })
  }, [enabled, personName, referredContents])

  return { aiIntro, aiIntroState, aiIntroError, refreshAiIntro }
}

// ============================================================================
// usePoemAiAnalysis
// ============================================================================

/**
 * 诗文 AI 赏析 Hook
 *
 * @param enabled - 是否启用（isPoemResource）
 * @param payload - 赏析请求参数，无 fullText 时自动跳过
 * @returns AI 赏析文本、状态、错误信息、手动刷新函数
 */
export function usePoemAiAnalysis(
  enabled: boolean,
  payload: {
    title: string
    author: string
    dynasty: string
    fullText: string
    background: string
    creationTime: string
    geoContext: string
  } | null,
): UsePoemAiAnalysisResult {
  const [poemAiAnalysis, setPoemAiAnalysis] = useState('')
  const [poemAiAnalysisState, setPoemAiAnalysisState] = useState<AiServiceState>('idle')
  const [poemAiAnalysisError, setPoemAiAnalysisError] = useState('')

  const _payloadKey = payload
    ? [
        payload.title, payload.author, payload.dynasty,
        payload.fullText, payload.background,
        payload.creationTime, payload.geoContext,
      ].join('\n')
    : ''

  useEffect(() => {
    if (!enabled) {
      setPoemAiAnalysis('')
      setPoemAiAnalysisState('idle')
      setPoemAiAnalysisError('')
      return
    }
    if (!payload || !payload.fullText) {
      setPoemAiAnalysis('')
      setPoemAiAnalysisState('idle')
      setPoemAiAnalysisError('')
      return
    }

    let active = true
    const cacheKey = buildPoemAiAnalysisCacheKey(payload)
    const cachedAnalysis = poemAiAnalysisCache.get(cacheKey)
    if (cachedAnalysis) {
      setPoemAiAnalysis(cachedAnalysis)
      setPoemAiAnalysisState('success')
      setPoemAiAnalysisError('')
      return () => { active = false }
    }

    setPoemAiAnalysisState('loading')
    setPoemAiAnalysisError('')

    requestPoemAiAnalysis(payload)
      .then((analysisText) => {
        if (!active) return
        if (analysisText) {
          poemAiAnalysisCache.set(cacheKey, analysisText)
        }
        setPoemAiAnalysis(analysisText)
        setPoemAiAnalysisState('success')
      })
      .catch((error) => {
        if (!active) return
        setPoemAiAnalysis('')
        setPoemAiAnalysisState('error')
        setPoemAiAnalysisError(resolveErrorMessage(error, POEM_AI_ANALYSIS_FALLBACK_ERROR_MESSAGE))
      })

    return () => { active = false }
  }, [enabled, payload])

  const refreshPoemAiAnalysis = useCallback(() => {
    if (!enabled || !payload || !payload.fullText) return

    const cacheKey = buildPoemAiAnalysisCacheKey(payload)
    setPoemAiAnalysisState('loading')
    setPoemAiAnalysis('')
    setPoemAiAnalysisError('')

    requestPoemAiAnalysis(payload)
      .then((analysisText) => {
        if (analysisText) {
          poemAiAnalysisCache.set(cacheKey, analysisText)
        }
        setPoemAiAnalysis(analysisText)
        setPoemAiAnalysisState('success')
      })
      .catch((error) => {
        setPoemAiAnalysis('')
        setPoemAiAnalysisState('error')
        setPoemAiAnalysisError(resolveErrorMessage(error, POEM_AI_ANALYSIS_FALLBACK_ERROR_MESSAGE))
      })
  }, [enabled, payload])

  return { poemAiAnalysis, poemAiAnalysisState, poemAiAnalysisError, refreshPoemAiAnalysis }
}
