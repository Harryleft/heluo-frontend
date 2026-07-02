import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

/**
 * ConceptDetailsPage 概念详情页面
 *
 * 专门用于显示概念类型的详情信息（韵部、体裁等）
 *
 * @example
 * ```tsx
 * // 访问路径: /details?uri=/concept/rhyme/xxx
 * <ConceptDetailsPage />
 * ```
 */
export function ConceptDetailsPage(): JSX.Element {
  const viewModel = useDetailPageViewModel()
  return <DetailPageContainer resourceType="concept" viewModel={viewModel} />
}
