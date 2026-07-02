import { useMemo } from 'react'
import { IIIFSection } from '@/features/common/IIIFSection'
import { AncientBookFieldPanel } from '@/features/details/components/entity-fields/AncientBookFieldPanel'
import { AncientBookVolumeTextSection } from '@/features/details/components/AncientBookVolumeTextSection'
import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'
import { EntityParser } from '@/lib/parse/data/EntityParser'

const PANEL_STYLE = { marginBottom: '1rem' }

function extractManifestsFromViewModel(entity: Record<string, unknown>, externalUris: string[]): string[] {
  if (externalUris.length > 0) return externalUris
  if (!entity || Object.keys(entity).length === 0) return []
  const parser = new EntityParser(entity)
  return parser.getIIIFManifests()
}

function renderMasthead(title?: string): JSX.Element | null {
  if (!title) return null
  return (
    <section className="ancient-book-detail__masthead" aria-label="古籍标题">
      <span className="ancient-book-detail__eyebrow">古籍影像</span>
      <h1>{title}</h1>
    </section>
  )
}

function renderIiifSection(manifests: string[]): JSX.Element | null {
  if (!manifests.length) return null
  return (
    <section className="panel ancient-book-detail__viewer-panel" style={PANEL_STYLE}>
      <IIIFSection manifests={manifests} embedded autoLoadEmbedded hideTitle hidePopupLink />
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
      {renderMasthead(data?.title)}
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
      {renderIiifSection(manifests)}
    </>
  )

  return <DetailPageContainer resourceType="ancient_book" viewModel={viewModel} topContent={topContent} />
}
