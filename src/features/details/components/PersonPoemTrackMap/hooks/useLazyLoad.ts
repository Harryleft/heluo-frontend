/**
 * 懒加载 Hook
 *
 * 使用 Intersection Observer 实现懒加载
 */

import { useEffect, useRef, useState } from 'react'
import type React from 'react'

export interface UseLazyLoadOptions {
  /** 触发阈值 (0-1) */
  threshold?: number
  /** 根元素边距 */
  rootMargin?: string
}

export interface UseLazyLoadResult<T extends Element> {
  /** 元素引用 */
  ref: React.RefObject<T>
  /** 是否在视口中 */
  isInView: boolean
}

/**
 * 使用 Intersection Observer 实现懒加载
 *
 * @param options - IntersectionObserver 选项
 * @returns { ref, isInView }
 *
 * @example
 * ```tsx
 * const { ref, isInView } = useLazyLoad<HTMLDivElement>({ threshold: 0.1 })
 *
 * return <div ref={ref}>{isInView ? '加载内容' : '占位符'}</div>
 * ```
 */
export function useLazyLoad<T extends Element>(
  options: UseLazyLoadOptions = {},
): UseLazyLoadResult<T> {
  const { threshold = 0.1, rootMargin = '100px' } = options

  const ref = useRef<T>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // 一旦进入视口就保持 true，不再观察
    if (isInView) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [isInView, threshold, rootMargin])

  return { ref, isInView } as const
}
