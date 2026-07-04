/**
 * PersonPoemTrackMap 常量定义
 *
 * 包含地图配置、动画配置等
 */

// ============================================================================
// 地图服务配置
// ============================================================================

/** 高德地图 JS API 版本（保留兼容，默认不再作为主线） */
export const AMAP_JS_API_VERSION = '2.0'

/** 高德地图 JS API URL（保留兼容） */
export const AMAP_JS_API_URL = 'https://webapi.amap.com/maps'

/** 高德地图脚本 ID */
export const AMAP_SCRIPT_ID = 'heluo-amap-jsapi-v2'

/** 地图默认缩放级别 */
export const AMAP_DEFAULT_ZOOM = 10

/** 从环境变量获取高德地图 Key */
export const AMAP_KEY = String(import.meta.env.REACT_AMAP_KEY || '').trim()

/** 从环境变量获取高德地图安全密钥 */
export const AMAP_SECURITY_JS_CODE = String(
  import.meta.env.REACT_AMAP_SECURITY_JS_CODE || '',
).trim()

/** 地图提供者：leaflet（默认）|amap */
export const MAP_PROVIDER = String(import.meta.env.REACT_MAP_PROVIDER || 'leaflet')
  .trim()
  .toLowerCase() as 'leaflet' | 'amap'

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
