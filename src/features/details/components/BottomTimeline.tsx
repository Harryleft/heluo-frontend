/**
 * BottomTimeline 底部时间轴组件
 *
 * 功能：
 * - 横向布局的年份滑块控制
 * - 播放/暂停动画按钮
 * - 年份刻度标记
 * - 半透明背景，覆盖在地图底部
 *
 * 参考: docs/reference/person-poem-track-contract.md
 */

import { useEffect, useMemo, useRef, useState, useCallback, SyntheticEvent } from 'react'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
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
 * BottomTimeline 底部时间轴组件
 *
 * 与 TrackTimeline 功能相同，但采用横向布局，适合放在地图底部
 *
 * @example
 * ```tsx
 * <BottomTimeline
 *   yearRange={{ start: 712, end: 770 }}
 *   currentYear={758}
 *   availableYears={[747, 754, 758, 765, 766]}
 *   onYearChange={(year) => console.log(year)}
 *   isPlaying={false}
 *   onPlayStateChange={(playing) => console.log(playing)}
 * />
 * ```
 */
export function BottomTimeline({
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
    (_event: Event | SyntheticEvent, value: number | number[]) => {
      const newValue = Array.isArray(value) ? value[0] : value
      onYearChange(newValue)
    },
    [onYearChange],
  )

  // 生成滑块刻度标记
  const sliderMarks = useMemo(() => {
    // 始终包含起止年份
    const marks: Array<{ value: number; label?: string }> = [
      { value: yearRange.start, label: `${yearRange.start}` },
      { value: yearRange.end, label: `${yearRange.end}` },
    ]
    return marks
  }, [yearRange])

  // 禁用状态：没有可用年份时禁用控制
  const isDisabled = availableYears.length === 0

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 1.5,
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 1,
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* 播放/暂停按钮 */}
      <Tooltip title={internalPlaying ? '暂停播放' : '播放轨迹'}>
        <IconButton
          onClick={handlePlayToggle}
          disabled={isDisabled}
          color={internalPlaying ? 'error' : 'primary'}
          size="medium"
          sx={{
            bgcolor: 'background.paper',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          {internalPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
      </Tooltip>

      {/* 当前年份显示 */}
      <Typography
        variant="h6"
        color="primary"
        sx={{
          minWidth: 70,
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        {currentYear !== null ? `${currentYear}年` : '---'}
      </Typography>

      {/* 时间线滑块 */}
      <Box sx={{ flex: 1, mx: 2 }}>
        <Slider
          min={yearRange.start}
          max={yearRange.end}
          value={currentYear ?? yearRange.start}
          onChange={handleSliderChange}
          disabled={isDisabled || internalPlaying}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}年`}
          marks={sliderMarks}
          step={1}
          sx={{
            '& .MuiSlider-markLabel': {
              fontSize: '0.75rem',
            },
          }}
        />
      </Box>

      {/* 年份范围显示 */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 100,
          textAlign: 'right',
        }}
      >
        {yearRange.start}年 - {yearRange.end}年
      </Typography>
    </Box>
  )
}
