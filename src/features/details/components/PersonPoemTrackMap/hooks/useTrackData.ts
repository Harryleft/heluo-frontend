/**
 * 轨迹数据管理 Hook
 *
 * 负责轨迹数据的获取和状态管理
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchPersonPoemTrack } from '@/lib/api/services/poemTrackService'
import type { PersonPoemTrack, PoemTrackPoint } from '@/types/contracts/poemTrackContracts'
import { getTrackPointKey } from '@/features/details/components/PersonPoemTrackMap/services/markerBuilder'

export interface UseTrackDataOptions {
  personId: string
  externalTrackData?: PersonPoemTrack | null
  isInView: boolean
  onLoadingChange?: (loading: boolean) => void
}

export interface UseTrackDataReturn {
  trackData: PersonPoemTrack | null
  loadStatus: 'idle' | 'loading' | 'success' | 'error'
  availableYears: number[]
  trackPointsByYear: Map<number, PoemTrackPoint[]>
}

/**
 * 轨迹数据管理 Hook
 */
export function useTrackData({
  personId,
  externalTrackData,
  isInView,
  onLoadingChange,
}: UseTrackDataOptions): UseTrackDataReturn {
  const [trackData, setTrackData] = useState<PersonPoemTrack | null>(
    externalTrackData || null,
  )
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  // 用于取消请求
  const cancelledRef = useRef(false)

  // 获取轨迹点中唯一的年份列表
  const availableYears = useMemo(() => {
    if (!trackData?.trackPoints) return []
    const years = new Set(trackData.trackPoints.map((p) => p.year))
    return Array.from(years).sort((a, b) => a - b)
  }, [trackData])

  // 按年份分组轨迹点
  const trackPointsByYear = useMemo(() => {
    const yearMap = new Map<number, PoemTrackPoint[]>()
    if (!trackData?.trackPoints) return yearMap
    trackData.trackPoints.forEach((point) => {
      const existingPoints = yearMap.get(point.year)
      if (existingPoints) {
        existingPoints.push(point)
      } else {
        yearMap.set(point.year, [point])
      }
    })
    return yearMap
  }, [trackData])

  // 懒加载轨迹数据
  useEffect(() => {
    // 未进入视口时不加载
    if (!isInView) return

    if (externalTrackData) {
      setTrackData(externalTrackData)
      setLoadStatus('success')
      return
    }

    cancelledRef.current = false

    setLoadStatus('loading')
    onLoadingChange?.(true)

    fetchPersonPoemTrack(personId)
      .then((result) => {
        if (cancelledRef.current) return
        if (result.success) {
          setTrackData(result.data)
          setLoadStatus('success')
        } else if (result.error?.code === 'REQUEST_CANCELED') {
          // 请求被取消（React StrictMode 双重渲染），不设置错误状态
        } else {
          setLoadStatus('error')
        }
      })
      .catch(() => {
        if (!cancelledRef.current) {
          setLoadStatus('error')
        }
      })
      .finally(() => {
        if (!cancelledRef.current) onLoadingChange?.(false)
      })

    return () => {
      cancelledRef.current = true
    }
  }, [personId, externalTrackData, onLoadingChange, isInView])

  return {
    trackData,
    loadStatus,
    availableYears,
    trackPointsByYear,
  }
}

export interface UseSelectionOptions {
  trackData: PersonPoemTrack | null
  trackPointsByYear: Map<number, PoemTrackPoint[]>
  initialYear?: number
}

export interface UseSelectionReturn {
  currentYear: number | null
  selectedTrackKey: string | null
  currentTrackPoint: PoemTrackPoint | null
  currentYearTrackPoints: PoemTrackPoint[]
  setCurrentYear: (year: number | null) => void
  setSelectedTrackKey: (key: string | null) => void
  handleYearChange: (year: number | null) => void
  handleTrackPointChange: (point: PoemTrackPoint) => void
}

/**
 * 选中状态管理 Hook
 */
export function useSelection({
  trackData,
  trackPointsByYear,
  initialYear,
}: UseSelectionOptions): UseSelectionReturn {
  const [currentYear, setCurrentYear] = useState<number | null>(initialYear || null)
  const [selectedTrackKey, setSelectedTrackKey] = useState<string | null>(null)

  // 当前年份的轨迹点
  const currentYearTrackPoints = useMemo(() => {
    if (currentYear === null) return []
    return trackPointsByYear.get(currentYear) || []
  }, [currentYear, trackPointsByYear])

  // 当前选中的轨迹点
  const currentTrackPoint = useMemo(() => {
    if (!trackData) return null
    if (selectedTrackKey) {
      const selected = trackData.trackPoints.find((p) => getTrackPointKey(p) === selectedTrackKey)
      if (selected) return selected
    }
    if (currentYear === null) return null
    return (trackPointsByYear.get(currentYear) || [])[0] || null
  }, [trackData, currentYear, selectedTrackKey, trackPointsByYear])

  // 维护当前选中地点
  useEffect(() => {
    if (!trackData?.trackPoints.length) {
      setSelectedTrackKey(null)
      return
    }

    if (selectedTrackKey) {
      const selected = trackData.trackPoints.find(
        (point) => getTrackPointKey(point) === selectedTrackKey,
      )
      if (selected) {
        if (currentYear !== selected.year) {
          setCurrentYear(selected.year)
        }
        return
      }
    }

    const targetByYear =
      currentYear !== null ? (trackPointsByYear.get(currentYear) || [])[0] : null
    const fallbackPoint = targetByYear || trackData.trackPoints[0]
    if (!fallbackPoint) return

    const fallbackYear = fallbackPoint.year
    const fallbackKey = getTrackPointKey(fallbackPoint)
    if (currentYear !== fallbackYear) {
      setCurrentYear(fallbackYear)
    }
    if (selectedTrackKey !== fallbackKey) {
      setSelectedTrackKey(fallbackKey)
    }
  }, [trackData, currentYear, selectedTrackKey, trackPointsByYear])

  // 处理年份变化
  const handleYearChange = useCallback(
    (year: number | null) => {
      setCurrentYear(year)
      if (year === null) {
        setSelectedTrackKey(null)
        return
      }
      const firstPointOfYear = (trackPointsByYear.get(year) || [])[0]
      setSelectedTrackKey(firstPointOfYear ? getTrackPointKey(firstPointOfYear) : null)
    },
    [trackPointsByYear],
  )

  // 处理轨迹点变化
  const handleTrackPointChange = useCallback((point: PoemTrackPoint) => {
    setCurrentYear(point.year)
    setSelectedTrackKey(getTrackPointKey(point))
  }, [])

  return {
    currentYear,
    selectedTrackKey,
    currentTrackPoint,
    currentYearTrackPoints,
    setCurrentYear,
    setSelectedTrackKey,
    handleYearChange,
    handleTrackPointChange,
  }
}
