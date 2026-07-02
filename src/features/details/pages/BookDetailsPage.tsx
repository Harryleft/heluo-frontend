import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

/**
 * BookDetailsPage 图书详情页面
 *
 * 专门用于显示图书类型的详情信息
 *
 * @example
 * ```tsx
 * // 访问路径: /details?uri=/book/xxx
 * <BookDetailsPage />
 * ```
 */
export function BookDetailsPage(): JSX.Element {
  const viewModel = useDetailPageViewModel()
  return <DetailPageContainer resourceType="book" viewModel={viewModel} />
}
