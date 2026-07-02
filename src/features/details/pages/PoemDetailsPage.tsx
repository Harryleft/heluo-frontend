import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

/**
 * PoemDetailsPage 诗文详情页面
 *
 * 专门用于显示诗文类型的详情信息
 *
 * @example
 * ```tsx
 * // 访问路径: /details?uri=/poem/set/xxx
 * <PoemDetailsPage />
 * ```
 */
export function PoemDetailsPage(): JSX.Element {
  const viewModel = useDetailPageViewModel()
  return <DetailPageContainer resourceType="poem" viewModel={viewModel} />
}
