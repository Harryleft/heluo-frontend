/**
 * 人物诗文地理轨迹相关类型定义
 *
 * 参考: docs/analysis/poem-track-map-plan.md
 */

// ============================================================================
// 核心数据类型
// ============================================================================

/**
 * 历史地名
 */
export interface HistoricalName {
  /** 历史名称，如"长安" */
  name: string
  /** 历史时期，如"唐代" */
  period: string
}

/**
 * 地点信息
 */
export interface TrackPlace {
  /** 地点 URI */
  uri: string
  /** 地点名称 */
  label: string
  /** 纬度 */
  lat: number
  /** 经度 */
  lng: number
  /** 历史地名列表（可选） */
  historicalNames?: HistoricalName[]
}

/**
 * 轨迹点关联的诗文
 */
export interface TrackPoem {
  /** 诗文 ID */
  id: string
  /** 诗文标题 */
  title: string
  /** 诗文 URI */
  uri: string
}

/**
 * 诗文轨迹点
 *
 * 表示人物在特定年份、特定地点创作的诗文集合
 */
export interface PoemTrackPoint {
  /** 年份（解析后的数字） */
  year: number
  /** 年份显示标签 */
  yearLabel: string
  /** 地点信息 */
  place: TrackPlace
  /** 该地点/年份创作的诗文列表 */
  poems: TrackPoem[]
}

/**
 * 无时间信息的诗文
 *
 * 用于显示没有具体年份信息的诗文
 */
export interface UndatedPoem {
  /** 诗文 ID */
  id: string
  /** 诗文标题 */
  title: string
  /** 关联地点（可选） */
  place?: {
    label: string
    lat: number
    lng: number
  }
}

/**
 * 生卒年信息
 */
export interface Lifespan {
  /** 出生年份（可能为空） */
  birth: number | null
  /** 逝世年份（可能为空） */
  death: number | null
  /** 生卒年显示标签 */
  label: string
}

/**
 * 年份范围
 */
export interface YearRange {
  /** 起始年份 */
  start: number
  /** 结束年份 */
  end: number
}

/**
 * 轨迹统计信息
 */
export interface TrackStats {
  /** 总诗文数量 */
  totalPoems: number
  /** 有年份信息的诗文数量 */
  datedPoems: number
  /** 涉及地点数量 */
  placesCount: number
  /** 年份范围（可能为空） */
  yearRange: YearRange | null
}

/**
 * 人物诗文地理轨迹完整数据
 */
export interface PersonPoemTrack {
  /** 人物 ID */
  personId: string
  /** 人物名称 */
  personName: string
  /** 生卒年 */
  lifespan: Lifespan
  /** 朝代 */
  dynasty: string
  /** 轨迹点列表（按年份排序） */
  trackPoints: PoemTrackPoint[]
  /** 无时间信息的诗文（附加显示） */
  undatedPoems: UndatedPoem[]
  /** 统计信息 */
  stats: TrackStats
}

// ============================================================================
// API 请求/响应类型
// ============================================================================

/**
 * 诗文轨迹 API 成功响应
 */
export interface PersonPoemTrackApiResponse {
  success: true
  data: PersonPoemTrack
}

/**
 * 诗文轨迹 API 错误响应
 */
export interface PersonPoemTrackApiError {
  success: false
  error: {
    code: 'PERSON_NOT_FOUND' | 'INVALID_PARAMS' | 'INTERNAL_ERROR' | 'REQUEST_CANCELED'
    message: string
    statusCode: number
  }
}

/**
 * 诗文轨迹 API 响应联合类型
 */
export type PersonPoemTrackApiResult =
  | PersonPoemTrackApiResponse
  | PersonPoemTrackApiError

// ============================================================================
// 组件 Props 类型
// ============================================================================

/**
 * PersonPoemTrackMap 组件 Props
 */
export interface PersonPoemTrackMapProps {
  /** 人物 ID */
  personId: string
  /** 轨迹数据（可选，未提供时自动获取） */
  trackData?: PersonPoemTrack
  /** 初始选中年份 */
  initialYear?: number
  /** 是否自动播放 */
  autoPlay?: boolean
  /** 动画间隔（毫秒） */
  animationInterval?: number
  /** 点击诗文回调 */
  onPoemClick?: (poem: TrackPoem) => void
  /** 加载状态回调 */
  onLoadingChange?: (loading: boolean) => void
}

/**
 * TrackTimeline 组件 Props
 */
export interface TrackTimelineProps {
  /** 年份范围 */
  yearRange: YearRange
  /** 当前年份 */
  currentYear: number | null
  /** 年份变化回调 */
  onYearChange: (year: number | null) => void
  /** 是否播放中 */
  isPlaying: boolean
  /** 播放状态变化回调 */
  onPlayStateChange: (isPlaying: boolean) => void
  /** 可用年份列表（有轨迹点的年份） */
  availableYears: number[]
  /** 动画间隔（毫秒） */
  animationInterval?: number
}

/**
 * PoemListPanel 组件 Props
 */
export interface PoemListPanelProps {
  /** 当前选中的轨迹点 */
  trackPoint: PoemTrackPoint | null
  /** 朝代（用于显示） */
  dynasty?: string
  /** 点击诗文回调 */
  onPoemClick?: (poem: TrackPoem) => void
}

// ============================================================================
// 地图相关类型
// ============================================================================

/**
 * 高德地图 Marker 配置
 */
export interface TrackMarkerConfig {
  /** 经纬度 */
  position: [number, number]
  /** 标记序号（诗文数量） */
  number: number
  /** 是否高亮 */
  isHighlighted: boolean
  /** 是否选中 */
  isSelected: boolean
  /** 年份标签 */
  yearLabel: string
  /** 地点名称 */
  placeLabel: string
  /** 历史地名（可选） */
  historicalNames?: HistoricalName[]
  /** 点击回调 */
  onClick: () => void
}

/**
 * 地图加载状态
 */
export type MapLoadStatus = 'idle' | 'loading' | 'ready' | 'error'
