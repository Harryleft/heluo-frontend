/**
 * PersonPoemTrackMap 人物诗文地理轨迹地图组件
 *
 * 功能：
 * - 动态加载地图 API
 * - 显示轨迹标记点（带数字，表示诗文数量）
 * - 绘制轨迹连线
 * - 自动适配地图视野
 * - 使用 MUI 组件改进 UI
 * - 懒加载：只有进入视口时才请求数据
 *
 * 参考: docs/reference/person-poem-track-contract.md
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import PlaceIcon from '@mui/icons-material/Place'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'

import { BottomTimeline } from '@/features/details/components/BottomTimeline'
import type {
  PersonPoemTrackMapProps,
  PoemTrackPoint,
  MapLoadStatus,
} from '@/types/contracts/poemTrackContracts'
import '@/types/map.global'

// 导入拆分后的模块
import { DEFAULT_ANIMATION_INTERVAL, DEFAULT_MAP_ZOOM } from './constants'
import { useLazyLoad } from './hooks/useLazyLoad'
import { useTrackData, useSelection } from './hooks/useTrackData'
import { loadMapJsApi, getTrackPointKey, createMarkers } from './services'
import { INK_COLORS } from './styles'
import { buildTrackPath, extractTrackPoints, getVisibleTrackPoints, getYearRange } from './utils'
import './styles/mapTheme.css'

// ============================================================================
// 主组件
// ============================================================================

function replacePolyline(
  MapApi: any,
  map: any,
  trackPoints: PoemTrackPoint[],
  currentYear: number | null,
  polylineRef: { current: any },
): void {
  if (polylineRef.current) {
    polylineRef.current.setMap(null)
    polylineRef.current = null
  }

  const path = buildTrackPath(trackPoints, currentYear)
    .map((point) => [point.lng, point.lat] as [number, number])
  if (path.length < 2) return

  polylineRef.current = new MapApi.Polyline({
    map,
    path,
    borderWeight: 2,
    strokeColor: INK_COLORS.line,
    strokeOpacity: 0.55,
    strokeDasharray: '6 8',
    lineJoin: 'round',
  })
}

/**
 * PersonPoemTrackMap 人物诗文地理轨迹地图组件
 *
 * @example
 * ```tsx
 * <PersonPoemTrackMap
 *   personId="17270"
 *   onPoemClick={(poem) => navigateToPoem(poem.uri)}
 * />
 * ```
 */
export function PersonPoemTrackMap({
  personId,
  trackData: externalTrackData,
  initialYear,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
  onPoemClick,
  onLoadingChange,
}: PersonPoemTrackMapProps): JSX.Element | null {
  // 懒加载：只有进入视口才加载数据
  const { ref: lazyLoadRef, isInView } = useLazyLoad<HTMLDivElement>()

  // 轨迹数据管理
  const { trackData, loadStatus, availableYears, trackPointsByYear } = useTrackData({
    personId,
    externalTrackData,
    isInView,
    onLoadingChange,
  })

  // 选中状态管理
  const {
    currentYear,
    selectedTrackKey,
    currentTrackPoint,
    currentYearTrackPoints,
    handleYearChange,
    handleTrackPointChange,
  } = useSelection({
    trackData,
    trackPointsByYear,
    initialYear,
  })

  // 地图状态
  const [mapStatus, setMapStatus] = useState<MapLoadStatus>('idle')
  const [isPlaying, setIsPlaying] = useState(false)

  // Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylineRef = useRef<any>(null)
  const selectionRef = useRef({ currentYear, selectedTrackKey })
  selectionRef.current = { currentYear, selectedTrackKey }

  // 加载地图
  useEffect(() => {
    if (!trackData?.trackPoints.length || !mapContainerRef.current) return

    let active = true
    setMapStatus('loading')

    loadMapJsApi()
      .then((MapApi) => {
        if (!active || !mapContainerRef.current) return

        const points = extractTrackPoints(
          getVisibleTrackPoints(trackData.trackPoints, selectionRef.current.currentYear),
        )
        if (points.length === 0) return

        // 创建地图实例
        const center: [number, number] = [points[0].lng, points[0].lat]
        const map = new MapApi.Map(mapContainerRef.current, {
          center,
          zoom: DEFAULT_MAP_ZOOM,
          viewMode: '2D',
        })

        mapRef.current = map

        replacePolyline(
          MapApi,
          map,
          trackData.trackPoints,
          selectionRef.current.currentYear,
          polylineRef,
        )

        // 添加标记点
        const yearRange = trackData.stats.yearRange || { start: 0, end: 0 }
        updateMarkers(
          MapApi,
          map,
          trackData.trackPoints,
          yearRange,
          selectionRef.current.currentYear,
          selectionRef.current.selectedTrackKey,
        )

        // 适配视野
        setTimeout(() => {
          if (map && active) {
            map.setFitView()
          }
        }, 100)

        setMapStatus('ready')
      })
      .catch(() => {
        if (active) setMapStatus('error')
      })

    return () => {
      active = false
      // 清理轨迹线
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
      // 清理标记点
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
      // 清理地图
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackData])

  /**
   * 更新标记点（累积显示）
   */
  const updateMarkers = useCallback(
    (
      MapApi: any,
      map: any,
      trackPoints: PoemTrackPoint[],
      yearRange: { start: number; end: number },
      year: number | null,
      trackKey: string | null,
    ) => {
      const handleMarkerClick = (clickedYear: number, clickedTrackKey: string) => {
        handleYearChange(clickedYear)
        handleTrackPointChange(
          trackPoints.find((p) => getTrackPointKey(p) === clickedTrackKey)!,
        )
      }

      createMarkers(
        MapApi,
        map,
        trackPoints,
        yearRange,
        year,
        trackKey,
        handleMarkerClick,
        markersRef.current,
      )
    },
    [handleYearChange, handleTrackPointChange],
  )

  // 更新标记点
  useEffect(() => {
    if (!mapRef.current || !trackData?.trackPoints) return

    const yearRange = trackData.stats.yearRange || { start: 0, end: 0 }
    loadMapJsApi().then((MapApi) => {
      if (!mapRef.current) return
      replacePolyline(MapApi, mapRef.current, trackData.trackPoints, currentYear, polylineRef)
      updateMarkers(MapApi, mapRef.current, trackData.trackPoints, yearRange, currentYear, selectedTrackKey)
    })
  }, [currentYear, trackData, updateMarkers, selectedTrackKey])

  // 当前年份变化时，地图自动平移到对应位置
  useEffect(() => {
    if (!mapRef.current || !currentTrackPoint) return

    const map = mapRef.current
    const { lng, lat } = currentTrackPoint.place

    // 平滑移动地图中心到当前位置
    map.panTo([lng, lat], undefined, 500)

    // 设置合适的缩放级别
    if (map.getZoom() < 8) {
      map.setZoom(8)
    }
  }, [currentTrackPoint])

  // 处理诗文点击
  const handlePoemClick = useCallback(
    (poem: { id: string; title: string; uri: string }) => {
      onPoemClick?.(poem)
    },
    [onPoemClick],
  )

  // 处理播放状态变化
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing)
  }, [])

  // 懒加载占位符：未进入视口时显示
  if (!isInView && loadStatus === 'idle') {
    return (
      <Card
        ref={lazyLoadRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          bgcolor: 'grey.50',
          border: '2px dashed',
          borderColor: 'grey.300',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'grey.100',
          },
        }}
      >
        <TravelExploreIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          诗文创作轨迹地图
        </Typography>
        <Typography variant="body2" color="text.secondary">
          滚动到此处时自动加载
        </Typography>
      </Card>
    )
  }

  // 加载状态渲染
  if (loadStatus === 'loading') {
    return (
      <Card ref={lazyLoadRef}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>正在加载轨迹数据...</Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  // 错误状态渲染
  if (loadStatus === 'error') {
    return (
      <Alert severity="error" icon={<ErrorOutlineIcon />}>
        加载轨迹数据失败，请稍后重试
      </Alert>
    )
  }

  // 空数据状态渲染
  if (!trackData || trackData.trackPoints.length === 0) {
    return (
      <Card ref={lazyLoadRef}>
        <CardContent>
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <PlaceIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography>暂无诗文轨迹数据</Typography>
            {trackData?.stats.totalPoems === 0 && (
              <Typography variant="body2" color="text.secondary">该人物暂无收录诗文</Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    )
  }

  // 获取年份范围
  const yearRange = getYearRange(trackData, availableYears)

  return (
    <Card ref={lazyLoadRef} className="person-poem-track-map">
      <CardContent>
        {/* 标题区域 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1, mb: 2 }}>
          <Typography variant="h5" color="primary" sx={{ fontSize: { xs: '1.15rem', sm: '1.5rem' } }}>
            {trackData.personName} · 诗文创作轨迹
          </Typography>
          <Chip
            label={`共 ${trackData.stats.totalPoems} 首诗文 · ${trackData.stats.placesCount} 个地点`}
            size="small"
            variant="outlined"
            sx={{
              color: '#5e4936',
              borderColor: 'rgba(111, 78, 48, 0.42)',
              bgcolor: 'rgba(247, 242, 230, 0.72)',
              fontFamily: '"Noto Serif SC", "Songti SC", serif',
            }}
          />
        </Box>

        {/* 主内容区 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 280px' }, gap: 2 }}>
          {/* 地图区域（包含底部时间轴） */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* 地图容器 */}
            <Box
              ref={mapContainerRef}
              className="person-poem-track-map__canvas"
              sx={{
                height: { xs: 280, sm: 340, md: 400 },
                bgcolor: '#e8e3d7',
                borderRadius: 1,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {mapStatus === 'loading' && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CircularProgress />
                </Box>
              )}
              {mapStatus === 'error' && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'error.main',
                  }}
                >
                  地图加载失败
                </Box>
              )}
            </Box>

            {/* 底部时间轴控制条 */}
            <Box sx={{ mt: 1 }}>
              <BottomTimeline
                yearRange={yearRange}
                currentYear={currentYear}
                availableYears={availableYears}
                onYearChange={handleYearChange}
                isPlaying={isPlaying}
                onPlayStateChange={handlePlayStateChange}
                animationInterval={animationInterval}
              />
            </Box>
          </Box>

          {/* 右侧诗文信息面板 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: { xs: 260, sm: 320, md: 456 } }}>
            {/* 诗文列表面板 */}
            <Card variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                {currentTrackPoint ? (
                  <>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {currentTrackPoint.yearLabel} · {currentTrackPoint.place.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {currentTrackPoint.poems.length} 首诗文
                    </Typography>
                    {currentYearTrackPoints.length > 1 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        {currentYearTrackPoints.map((point) => {
                          const key = getTrackPointKey(point)
                          const isSelected = selectedTrackKey === key
                          return (
                            <Chip
                              key={key}
                              label={point.place.label}
                              size="small"
                              clickable
                              color={isSelected ? 'primary' : 'default'}
                              variant={isSelected ? 'filled' : 'outlined'}
                              onClick={() => handleTrackPointChange(point)}
                            />
                          )
                        })}
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {currentYear ? '该年份暂无诗文数据' : '请选择年份查看诗文'}
                  </Typography>
                )}
              </Box>

              {/* 诗文列表 - 固定高度，超出滚动 */}
              {currentTrackPoint && (
                <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {currentTrackPoint.poems.map((poem, index) => (
                    <Box key={poem.id}>
                      <ListItemButton
                        onClick={() => handlePoemClick(poem)}
                        sx={{ px: 2 }}
                      >
                        <ListItemText
                          primary={poem.title}
                          secondary="查看详情 →"
                        />
                      </ListItemButton>
                      {index < currentTrackPoint.poems.length - 1 && (
                        <Divider />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Card>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
