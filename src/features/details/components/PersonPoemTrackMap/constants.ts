/**
 * PersonPoemTrackMap 常量定义
 *
 * 包含高德地图配置、动画配置等
 */

// ============================================================================
// 高德地图配置
// ============================================================================

/** 高德地图 JS API 版本 */
export const AMAP_JS_API_VERSION = '2.0'

/** 高德地图 JS API URL */
export const AMAP_JS_API_URL = 'https://webapi.amap.com/maps'

/** 高德地图脚本 ID */
export const AMAP_SCRIPT_ID = 'heluo-amap-jsapi-v2'

/** 高德地图默认缩放级别 */
export const AMAP_DEFAULT_ZOOM = 10

/** 从环境变量获取高德地图 Key */
export const AMAP_KEY = String(import.meta.env.REACT_AMAP_KEY || '').trim()

/** 从环境变量获取高德地图安全密钥 */
export const AMAP_SECURITY_JS_CODE = String(
  import.meta.env.REACT_AMAP_SECURITY_JS_CODE || '',
).trim()

// ============================================================================
// 动画配置
// ============================================================================

/** 默认动画间隔（毫秒） */
export const DEFAULT_ANIMATION_INTERVAL = 1500
