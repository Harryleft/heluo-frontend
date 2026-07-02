import { useMemo } from 'react'
import { IIIFSection } from '@/features/common/IIIFSection'
import { AncientBookFieldPanel } from '@/features/details/components/entity-fields/AncientBookFieldPanel'
import { AncientBookVolumeTextSection } from '@/features/details/components/AncientBookVolumeTextSection'
import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'
import { EntityParser } from '@/lib/parse/data/EntityParser'

function extractManifestsFromViewModel(entity: Record<string, unknown>, externalUris: string[]): string[] {
  if (externalUris.length > 0) return externalUris
  if (!entity || Object.keys(entity).length === 0) return []
  const parser = new EntityParser(entity)
  return parser.getIIIFManifests()
}

function renderIiifSection(title: string | undefined, manifests: string[]): JSX.Element | null {
  if (!manifests.length) return null
  return (
    <section className="ancient-book-detail__reader" aria-label="古籍影像查看器">
      <div className="ancient-book-detail__reader-bar">
        <div>
          <span className="ancient-book-detail__eyebrow">古籍影像</span>
          <h1>{title || '未命名古籍'}</h1>
        </div>
        <span className="ancient-book-detail__reader-count">{manifests.length} 个影像源</span>
      </div>
      <IIIFSection
        manifests={manifests}
        embedded
        autoLoadEmbedded
        hideTitle
        hidePopupLink
        height="calc(100vh - 228px)"
      />
    </section>
  )
}

export function AncientBookDetailsPage(): JSX.Element {
  const viewModel = useDetailPageViewModel()
  const data = viewModel.data
  const manifests = useMemo(
    () => extractManifestsFromViewModel(viewModel.entity, viewModel.externalUris),
    [viewModel.entity, viewModel.externalUris],
  )

  const topContent = (
    <>
      <AncientBookFieldPanel
        entity={viewModel.entity}
        digitalResourceCount={viewModel.externalUris.length}
      />
      <AncientBookVolumeTextSection
        label={data?.ancientBookVolumeLabel}
        text={data?.ancientBookVolumeText}
        status={data?.ancientBookVolumeTextStatus}
        message={data?.ancientBookVolumeTextMessage}
        sourceUri={data?.ancientBookVolumeTextSourceUri}
      />
      {renderIiifSection(data?.title, manifests)}
    </>
  )

  return <DetailPageContainer resourceType="ancient_book" viewModel={viewModel} topContent={topContent} />
}
