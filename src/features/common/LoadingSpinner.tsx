import React, { useEffect } from 'react'
import { injectStyles } from '@/lib/dom/injectStyles'

/**
 * LoadingSpinner 组件样式
 * 使用品牌主题色和优雅的动画效果
 */
const loadingSpinnerStyles = `
  .loading-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .loading-spinner__container {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .loading-spinner__ring {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid var(--yale-light, #f8f9fa);
    border-top-color: var(--yale-primary, #003366);
    border-right-color: var(--yale-link, #007bff);
    animation: loading-spinner-rotate 0.8s linear infinite;
  }

  .loading-spinner--sm .loading-spinner__ring {
    width: 24px;
    height: 24px;
    border-width: 2px;
  }

  .loading-spinner--lg .loading-spinner__ring {
    width: 56px;
    height: 56px;
    border-width: 4px;
  }

  .loading-spinner__icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--yale-primary, #003366);
    font-size: 14px;
    animation: loading-spinner-pulse 1.2s ease-in-out infinite;
  }

  .loading-spinner--sm .loading-spinner__icon {
    font-size: 10px;
  }

  .loading-spinner--lg .loading-spinner__icon {
    font-size: 20px;
  }

  .loading-spinner__text {
    color: var(--yale-muted, #666666);
    font: var(--yale-font-body, 400 14px/20px system-ui, -apple-system, sans-serif);
    animation: loading-spinner-fade 1.5s ease-in-out infinite;
  }

  .loading-spinner--centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--yale-padding-lg, 24px);
    min-height: 120px;
  }

  /* 动画关键帧 */
  @keyframes loading-spinner-rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes loading-spinner-pulse {
    0%, 100% {
      opacity: 0.6;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  @keyframes loading-spinner-fade {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  /* 减少动画偏好 */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner__ring,
    .loading-spinner__icon,
    .loading-spinner__text {
      animation: none;
    }

    .loading-spinner__ring {
      border-top-color: var(--yale-primary, #003366);
      border-right-color: var(--yale-primary, #003366);
    }

    .loading-spinner__icon,
    .loading-spinner__text {
      opacity: 1;
    }
  }
`

/**
 * LoadingSpinner 组件属性
 */
interface LoadingSpinnerProps {
  /** 加载指示器尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 可选的自定义类名 */
  className?: string
  /** 是否居中显示 */
  centered?: boolean
  /** 加载文本 */
  text?: string
}

/**
 * 加载状态指示器组件
 *
 * 使用品牌主题色显示加载动画，支持无障碍访问和减少动画偏好。
 *
 * @example
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner size="sm" />
 * <LoadingSpinner size="lg" centered text="加载中..." />
 * ```
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  centered = false,
  text,
}) => {
  // 注入样式
  useEffect(() => {
    injectStyles('loading-spinner', loadingSpinnerStyles)
  }, [])

  const sizeClass = size === 'md' ? '' : `loading-spinner--${size}`
  const centeredClass = centered ? 'loading-spinner--centered' : ''

  return (
    <div
      className={`loading-spinner ${sizeClass} ${centeredClass} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="loading-spinner"
    >
      <div className="loading-spinner__container">
        <div className="loading-spinner__ring" />
        <span className="loading-spinner__icon" aria-hidden="true">
          <i className="bi bi-book" />
        </span>
      </div>
      {text && <span className="loading-spinner__text">{text}</span>}
      <span className="visually-hidden">加载中...</span>
    </div>
  )
}
