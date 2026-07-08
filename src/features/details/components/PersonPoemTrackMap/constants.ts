/**
 * PersonPoemTrackMap 常量定义
 */

// ============================================================================
// 地图服务配置
// ============================================================================

/** 地图默认缩放级别 */
export const DEFAULT_MAP_ZOOM = 10

/** Leaflet JS 资源地址 */
export const LEAFLET_JS_URL = String(
  import.meta.env.REACT_LEAFLET_JS_URL || 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
).trim()

/** Leaflet CSS 资源地址 */
export const LEAFLET_CSS_URL = String(
  import.meta.env.REACT_LEAFLET_CSS_URL ||
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
).trim()

/** Leaflet 瓦片服务地址 */
export const LEAFLET_TILE_URL = String(
  import.meta.env.REACT_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
).trim()

/** Leaflet 版权标注 */
export const LEAFLET_MAP_ATTRIBUTION = String(
  import.meta.env.REACT_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors',
).trim()

/** Leaflet 脚本标签 ID */
export const LEAFLET_SCRIPT_ID = 'heluo-leaflet-js'

/** Leaflet 样式标签 ID */
export const LEAFLET_CSS_ID = 'heluo-leaflet-css'

// ============================================================================
// 动画配置
// ============================================================================

/** 默认动画间隔（毫秒） */
export const DEFAULT_ANIMATION_INTERVAL = 1500
