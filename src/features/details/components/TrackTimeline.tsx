/**
 * TrackTimeline 诗文轨迹时间线组件
 *
 * 功能：
 * - 年份滑块控制（使用 MUI Slider）
 * - 播放/暂停动画（使用 MUI IconButton）
 * - 当前年份显示（使用 MUI Typography）
 * - 可用年份标签（使用 MUI Chip）
 *
 * 参考: docs/reference/person-poem-track-contract.md
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { TrackTimelineProps } from '@/types/contracts/poemTrackContracts'

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_ANIMATION_INTERVAL = 1500 // 1.5秒

// ============================================================================
// 公共组件
// ============================================================================

/**
 * TrackTimeline 诗文轨迹时间线组件
 *
 * @example
 * ```tsx
 * <TrackTimeline
 *   yearRange={{ start: 712, end: 770 }}
 *   currentYear={758}
 *   availableYears={[747, 754, 758, 765, 766]}
 *   onYearChange={(year) => console.log(year)}
 *   isPlaying={false}
 *   onPlayStateChange={(playing) => console.log(playing)}
 * />
 * ```
 */
export function TrackTimeline({
  yearRange,
  currentYear,
  availableYears = [],
  onYearChange,
  isPlaying = false,
  onPlayStateChange,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
}: TrackTimelineProps): JSX.Element {
  // 内部状态
  const [internalPlaying, setInternalPlaying] = useState(isPlaying)
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 计算可用年份中当前年份的索引
  const currentYearIndex = useMemo(() => {
    if (currentYear === null) return -1
    return availableYears.findIndex((y) => y === currentYear)
  }, [currentYear, availableYears])

  // 播放控制逻辑
  useEffect(() => {
    // 清理定时器
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current)
      playTimerRef.current = null
    }

    // 如果不在播放状态或没有可用年份，直接返回
    if (!internalPlaying || availableYears.length === 0) return

    // 计算下一个年份索引
    let nextIndex = currentYearIndex
    if (nextIndex < 0) {
      nextIndex = 0
    } else {
      nextIndex = (currentYearIndex + 1) % availableYears.length
    }

    // 设置定时器
    playTimerRef.current = setTimeout(() => {
      const nextYear = availableYears[nextIndex]
      onYearChange(nextYear)

      // 如果回到起点，停止播放
      if (nextIndex === 0 && currentYearIndex >= 0) {
        setInternalPlaying(false)
        onPlayStateChange(false)
      }
    }, animationInterval)

    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current)
        playTimerRef.current = null
      }
    }
  }, [
    internalPlaying,
    currentYearIndex,
    availableYears,
    onYearChange,
    onPlayStateChange,
    animationInterval,
  ])

  // 同步外部 isPlaying 状态
  useEffect(() => {
    setInternalPlaying(isPlaying)
  }, [isPlaying])

  /**
   * 处理播放/暂停按钮点击
   */
  const handlePlayToggle = useCallback(() => {
    const newState = !internalPlaying
    setInternalPlaying(newState)
    onPlayStateChange(newState)
  }, [internalPlaying, onPlayStateChange])

  /**
   * 处理滑块值变化
   */
  const handleSliderChange = useCallback(
    (_event: any, value: number | number[]) => {
      const newValue = Array.isArray(value) ? value[0] : value
      onYearChange(newValue)
    },
    [onYearChange],
  )

  /**
   * 处理年份标签点击
   */
  const handleYearTagClick = useCallback(
    (year: number) => {
      onYearChange(year)
    },
    [onYearChange],
  )

  // 禁用状态：没有可用年份时禁用控制
  const isDisabled = availableYears.length === 0

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
      {/* 头部：当前年份 + 播放按钮 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" color="primary">
          {currentYear !== null ? `${currentYear}年` : '选择年份'}
        </Typography>
        <Tooltip title={internalPlaying ? '暂停播放' : '播放轨迹'}>
          <IconButton
            onClick={handlePlayToggle}
            disabled={isDisabled}
            color={internalPlaying ? 'error' : 'primary'}
            size="small"
          >
            {internalPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 时间线滑块 */}
      <Box sx={{ mb: 1 }}>
        <Slider
          min={yearRange.start}
          max={yearRange.end}
          value={currentYear ?? yearRange.start}
          onChange={handleSliderChange}
          disabled={isDisabled || internalPlaying}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}年`}
          marks={[
            { value: yearRange.start, label: `${yearRange.start}年` },
            { value: yearRange.end, label: `${yearRange.end}年` },
          ]}
        />
      </Box>

      {/* 可用年份标签 */}
      {availableYears.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {availableYears.map((year) => (
            <Chip
              key={year}
              label={`${year}年`}
              onClick={() => handleYearTagClick(year)}
              disabled={internalPlaying}
              color={year === currentYear ? 'primary' : 'default'}
              variant={year === currentYear ? 'filled' : 'outlined'}
              size="small"
              sx={{ cursor: internalPlaying ? 'not-allowed' : 'pointer' }}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}
