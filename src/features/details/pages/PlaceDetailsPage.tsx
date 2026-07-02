import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

/**
 * PlaceDetailsPage 地点详情页面
 *
 * 专门用于显示地点类型的详情信息
 *
 * @example
 * ```tsx
 * // 访问路径: /details?uri=/place/xxx
 * <PlaceDetailsPage />
 * ```
 */
export function PlaceDetailsPage(): JSX.Element {
  const viewModel = useDetailPageViewModel()
  return <DetailPageContainer resourceType="place" viewModel={viewModel} />
}
