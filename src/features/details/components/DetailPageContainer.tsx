import type { ReactNode } from 'react'
import { LoadingSpinner } from '@/features/common/LoadingSpinner'
import { OverviewTab } from '@/features/details/OverviewTab'
import type { DetailResourceType } from '@/features/details/utils/uriParser'
import type { DetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

interface DetailPageContainerProps {
  resourceType: DetailResourceType
  viewModel: DetailPageViewModel
  topContent?: ReactNode
  bottomContent?: ReactNode
}

/**
 * 详情页通用容器 - 经典学术风格
 */
export function DetailPageContainer({
  resourceType,
  viewModel,
  topContent = null,
  bottomContent = null,
}: DetailPageContainerProps): JSX.Element {
  const {
    pageState,
    data,
    error,
    entitySummary,
    entity,
    externalUris,
    enrichedLinks,
    query,
  } = viewModel
  const displayInternalLinks = enrichedLinks.length ? enrichedLinks : (data?.internalLinks || [])

  if (pageState === 'loading') {
    return (
      <main className="classic-detail-page">
        <section className="classic-detail-loading">
          <div className="classic-detail-loading__spinner">
            <LoadingSpinner />
          </div>
          <p className="classic-detail-loading__text">正在加载详情...</p>
          <div className="classic-detail-loading__decoration">
            <span className="classic-detail-loading__line" />
            <span className="classic-detail-loading__ornament">*</span>
            <span className="classic-detail-loading__line" />
          </div>
        </section>
        <footer className="classic-footer">
          <div className="classic-footer-text">
            <span>河洛文化</span>
            <span className="classic-footer-separator">·</span>
            <span>源远流长</span>
          </div>
        </footer>
      </main>
    )
  }

  if (pageState === 'error' || !data) {
    return (
      <main className="classic-detail-page">
        <section className="classic-detail-error">
          <div className="classic-detail-error__icon">!</div>
          <h1 className="classic-detail-error__title">加载失败</h1>
          <p className="classic-detail-error__message">{error || '未知错误'}</p>
          <div className="classic-detail-error__decoration" />
        </section>
        <footer className="classic-footer">
          <div className="classic-footer-text">
            <span>河洛文化</span>
            <span className="classic-footer-separator">·</span>
            <span>源远流长</span>
          </div>
        </footer>
      </main>
    )
  }

  return (
    <main className="classic-detail-page">
      <OverviewTab
        data={data}
        summary={entitySummary}
        entity={entity}
        internalLinks={displayInternalLinks}
        externalUris={externalUris}
        resourceType={resourceType}
        query={query}
        mainContent={topContent}
      />
      {bottomContent}
      <footer className="classic-footer">
        <div className="classic-footer-text">
          <span>河洛文化</span>
          <span className="classic-footer-separator">·</span>
          <span>源远流长</span>
        </div>
      </footer>
    </main>
  )
}
