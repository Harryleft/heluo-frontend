/**
 * OverviewTab - Detail page content renderer
 *
 * Renders entity summary, type-specific panels, metadata, and related resources
 * for different resource types (person, book, place, poem, concept, ancient_book).
 *
 * Features:
 * - Person: AI-generated introduction, biography section
 * - Book: Hero section with cover, ISBN display
 * - Place: Parent location hierarchy
 * - Poem: Dedicated poem detail card
 * - Related resources via vector search
 * - External links sidebar
 *
 * @module OverviewTab
 */

// ============================================================================
// IMPORTS
// ============================================================================

// React
import { useMemo, useState, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'

// Components
import { EntityMetadata } from '@/features/common/EntityMetadata'
import { BiographySection } from '@/features/details/BiographySection'
import { PoemDetailCard } from '@/features/details/PoemDetailCard'
import { AncientBookFieldPanel } from '@/features/details/components/entity-fields/AncientBookFieldPanel'
import { BookFieldPanel } from '@/features/details/components/entity-fields/BookFieldPanel'
import { ConceptFieldPanel } from '@/features/details/components/entity-fields/ConceptFieldPanel'
import { PlaceFieldPanel } from '@/features/details/components/entity-fields/PlaceFieldPanel'
// Sidebar
import { SidebarAccordion, type AccordionItem } from '@/features/details/components/overview/SidebarAccordion'
// AI 内容渲染器
import { AiContentRenderer } from '@/features/details/components/overview/AiContentRenderer'
// AI 服务 Hooks
import { usePersonAiIntro, usePoemAiAnalysis, type AiServiceState } from '@/features/details/hooks/useAiServices'
// 外部链接工具
import { getExternalSourceLabel } from '@/features/details/utils/externalLinkUtils'

// Styles
import overviewTabStyles from '@/styles/features/details/OverviewTab'

// Utils
import { injectStyles } from '@/lib/dom/injectStyles'
import {
  buildRelatedSearchQuery as _buildRelatedSearchQuery,
  buildResultItemKey as _buildResultItemKey,
} from '@/features/details/utils/relatedResources'
import {
  extractPersonReferredContentsFromEntity as _extractPersonReferredContentsFromEntity,
  extractPlaceParentLinks as _extractPlaceParentLinks,
  extractPoemCreationTime as _extractPoemCreationTime,
  extractPoemGeoContext as _extractPoemGeoContext,
  getResourceTypeLabel as _getResourceTypeLabel,
} from '@/features/details/utils/entityExtract'
import { extractPersonName as _extractPersonName, groupByRelationType as _groupByRelationType } from '@/features/details/utils/relationGrouping'
import { getRelevanceLevel as _getRelevanceLevel } from '@/features/details/utils/relevanceUtils'
import { extractBookIsbn as _extractBookIsbn } from '@/features/details/utils/isbnExtract'
import {
  MAX_EXTERNAL_LINKS,
  POEM_AI_ANALYSIS_EMPTY_MESSAGE,
} from '@/features/details/constants/overviewConstants'
import { useBookCover, useRelatedResources } from '@/features/details/hooks/useOverviewTabData'

// Types
import type { DetailResourceType } from '@/features/details/utils/uriParser'
import type { DetailViewModel, InternalLinkViewModel, SearchResultItemV1 } from '@/types/api'
import type {
  BookHeroSectionProps,
  OverviewTabProps,
  PlaceParentLinkView,
  RelationGroup,
  TypeSpecificSectionProps,
} from '@/features/details/types/overviewTab'

// 类型别名
type RelatedState = 'idle' | 'loading' | 'success' | 'error'
type VectorRelatedItem = SearchResultItemV1

// ============================================================================
// PUBLIC COMPONENTS
// ============================================================================

/**
 * OverviewTab - Main detail page content component
 *
 * Renders the appropriate layout based on resource type with
 * main content area and optional sidebar for related resources.
 */
export function OverviewTab({
  data,
  summary,
  entity,
  internalLinks: _internalLinks = [],
  externalUris = [],
  resourceType = 'unknown',
  className = '',
  mainContent,
}: OverviewTabProps): JSX.Element {
  // 注入样式
  injectStyles('overview-tab', overviewTabStyles)

  // Resource type flags
  const isBookResource = resourceType === 'book'
  const isPoemResource = resourceType === 'poem'
  const isPlaceResource = resourceType === 'place'
  const isPersonResource = resourceType === 'person'
  const isConceptResource = resourceType === 'concept'
  const isAncientBookResource = resourceType === 'ancient_book'

  // Derived values
  const totalExternalLinks = externalUris.length
  const personName = summary.title || data.title || '该人物'
  const bookIsbn = useMemo(() => _extractBookIsbn(entity), [entity])
  const bookCoverUrl = useBookCover({
    isBookResource,
    title: summary.title || data.title || '未命名图书',
    isbn: bookIsbn,
  })
  const relatedQuery = useMemo(
    () => _buildRelatedSearchQuery(summary.title || data.title, summary.snippet || data.summary),
    [data.summary, data.title, summary.snippet, summary.title],
  )
  const referredContents = useMemo(() => _extractPersonReferredContentsFromEntity(entity), [entity])
  const poemAnalysisPayload = useMemo(() => {
    const poemDetail = data.poemDetail
    if (!poemDetail) return null
    const creationTime = _extractPoemCreationTime(data.doc)
    const geoContext = _extractPoemGeoContext(poemDetail.relatedPlaces)
    return {
      title: poemDetail.title || summary.title || data.title || '',
      author: poemDetail.author || '',
      dynasty: poemDetail.dynasty || '',
      fullText: poemDetail.fullText || '',
      background: summary.snippet || data.summary || '',
      creationTime,
      geoContext,
    }
  }, [data.doc, data.poemDetail, data.summary, data.title, summary.snippet, summary.title])
  const placeParentLinks = useMemo(() => _extractPlaceParentLinks(entity), [entity])

  // AI 服务 Hooks（替代 useState + useEffect + 缓存逻辑）
  const { aiIntro, aiIntroState, aiIntroError, refreshAiIntro } = usePersonAiIntro(isPersonResource, personName, referredContents)
  const { poemAiAnalysis, poemAiAnalysisState, poemAiAnalysisError, refreshPoemAiAnalysis } = usePoemAiAnalysis(isPoemResource, poemAnalysisPayload)

  // Display flags
  const showExternalLinks = !isPoemResource && !isBookResource && totalExternalLinks > 0
  const showVectorRelated = !isPlaceResource && !isConceptResource
  const showSidebar = isPersonResource || isBookResource || showVectorRelated || showExternalLinks

  // CSS class composition
  const rootClassName = [
    'yale-overview-tab',
    isPersonResource ? 'yale-overview-tab--person' : '',
    isBookResource ? 'yale-overview-tab--book' : '',
    isPlaceResource ? 'yale-overview-tab--place' : '',
    !showSidebar ? 'yale-overview-tab--no-sidebar' : '',
    className,
  ].filter(Boolean).join(' ')

  const { relatedResources, relatedState } = useRelatedResources({
    dataUri: data.uri,
    dataTitle: data.title,
    dataSummary: data.summary,
    summaryTitle: summary.title,
    summarySnippet: summary.snippet,
    relatedQuery,
    resourceType,
    isBookResource,
    isPlaceResource,
    isConceptResource,
    bookIsbn,
    internalLinks: _internalLinks,
  })

  return (
    <div className={rootClassName}>
      <div className="yale-overview-tab__main">
        {mainContent}
        {isAncientBookResource ? null : isPersonResource ? (
          _renderPersonContent(entity, summary, data)
        ) : isBookResource ? (
            _renderBookContent(summary, data, bookIsbn, bookCoverUrl, resourceType, entity)
        ) : isPlaceResource ? (
          _renderPlaceContent(summary, data, placeParentLinks, resourceType, entity)
        ) : isPoemResource ? (
          _renderPoemContent(data, poemAnalysisPayload)
        ) : (
          _renderDefaultContent(summary, data, entity, resourceType, isPoemResource, isAncientBookResource, isConceptResource)
        )}
      </div>

      {showSidebar && (
        <aside className="yale-overview-tab__sidebar">
          <SidebarAccordion
            items={_buildSidebarAccordionItems({
              isPersonResource,
              isPoemResource,
              referredContents,
              aiIntroState,
              aiIntro,
              aiIntroError,
              refreshAiIntro,
              internalLinks: _internalLinks,
              showVectorRelated,
              relatedResources,
              relatedState,
              showExternalLinks,
              externalUris,
              totalExternalLinks,
              resourceType,
              // 诗文 AI 赏析
              poemAiAnalysisState,
              poemAiAnalysis,
              poemAiAnalysisError,
              hasFullText: Boolean(poemAnalysisPayload?.fullText),
              refreshPoemAiAnalysis,
            })}
          />
        </aside>
      )}
    </div>
  )
}

/**
 * TypeSpecificSection - Renders resource-type-specific field panels
 */
function TypeSpecificSection({ resourceType, data, summary, entity }: TypeSpecificSectionProps): JSX.Element | null {
  if (!resourceType || !entity || Object.keys(entity).length === 0) return null

  switch (resourceType) {
    case 'book':
      return <BookFieldPanel entity={entity} summarySnippet={summary.snippet} />
    case 'place':
      return <PlaceFieldPanel entity={entity} />
    case 'concept':
      return <ConceptFieldPanel entity={entity} />
    case 'ancient_book':
      return <AncientBookFieldPanel entity={entity} digitalResourceCount={data.externalUris.length} />
    default:
      return null
  }
}

/**
 * BookHeroSection - Hero display for book resources
 */
function BookHeroSection({
  title,
  snippet,
  isbn,
  coverUrl = '',
}: BookHeroSectionProps): JSX.Element {
  return (
    <section className="yale-overview-tab__section yale-overview-tab__section--book-hero">
      <div className="yale-overview-tab__book-hero-head">
        <div className="yale-overview-tab__book-cover-wrapper">
          <span className="yale-overview-tab__book-cover-title">图书封面</span>
          {coverUrl ? (
            <img
              className="yale-overview-tab__book-cover-image"
              src={coverUrl}
              alt={`${title} 图书封面`}
              loading="lazy"
            />
          ) : (
            <div className="yale-overview-tab__book-hero-cover yale-overview-tab__book-hero-cover--placeholder" aria-label="图书封面占位">
              <span className="yale-overview-tab__book-cover-title">{title}</span>
            </div>
          )}
        </div>
        <div className="yale-overview-tab__book-hero-body">
          <h2 className="yale-overview-tab__book-hero-title">{title}</h2>
          <div className="yale-overview-tab__book-hero-chips">
            <span className="yale-overview-tab__book-hero-chip">图书</span>
            {isbn && <span className="yale-overview-tab__book-hero-chip">ISBN {isbn}</span>}
            <span className="yale-overview-tab__book-hero-chip">馆藏资源</span>
          </div>
          <p className="yale-overview-tab__book-hero-summary">{snippet || '暂无摘要'}</p>
        </div>
      </div>
    </section>
  )
}

/**
 * RelationTypeGroup - Single relation type group component
 */
function RelationTypeGroup({ group, groupIndex }: { group: RelationGroup; groupIndex: number }): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(group.defaultExpanded)
  const contentId = `relation-type-content-${groupIndex}`
  const themeClass = `yale-overview-tab__relation-group--${group.colorTheme}`

  const handleToggle = () => setIsExpanded(!isExpanded)

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsExpanded(!isExpanded)
    }
  }

  return (
    <div className={`yale-overview-tab__relation-group ${themeClass}`}>
      <div
        className="yale-overview-tab__relation-group-header"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onKeyDown={handleKeyDown}
      >
        <span className="yale-overview-tab__relation-group-type">{group.relationType}</span>
        <span className="yale-overview-tab__relation-group-count">{group.items.length}人</span>
        <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} yale-overview-tab__relation-group-toggle`} />
      </div>

      {isExpanded && (
        <div id={contentId} className="yale-overview-tab__relation-group-content">
          <div className="yale-overview-tab__relation-person-grid">
            {group.items.map((item, index) => {
              const personName = _extractPersonName(item.label)

              return (
                <Link
                  key={`${item.uri}-${index}`}
                  to={`/details?uri=${encodeURIComponent(item.uri)}`}
                  className="yale-overview-tab__relation-person-card"
                >
                  <span className="yale-overview-tab__relation-person-name">{personName}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// PRIVATE IMPLEMENTATION - Content Renderers
// ============================================================================

function _renderPersonContent(
  entity: Record<string, unknown> | undefined,
  summary: OverviewTabProps['summary'],
  data: DetailViewModel,
): JSX.Element {
  return (
    <>
      {entity && Object.keys(entity).length > 0 && (
        <section className="yale-overview-tab__section yale-overview-tab__section--metadata">
          <h2 className="yale-overview-tab__person-title">{summary.title || data.title || '未命名人物'}</h2>
          <EntityMetadata
            entity={entity}
            showCreators
            showPlaces={false}
            showClassifications={false}
            showPartOf={false}
            showHasPart={false}
          />
        </section>
      )}
      {summary.biography?.hasStructuredData && (
        <section className="yale-overview-tab__section yale-overview-tab__section--summary">
          <BiographySection data={summary.biography} />
        </section>
      )}
    </>
  )
}

function _renderBookContent(
  summary: OverviewTabProps['summary'],
  data: DetailViewModel,
  bookIsbn: string,
  bookCoverUrl: string,
  resourceType: DetailResourceType,
  entity: Record<string, unknown> | undefined,
): JSX.Element {
  return (
    <>
      <BookHeroSection
        title={summary.title || data.title || '未命名图书'}
        snippet={summary.snippet || data.summary || '暂无摘要'}
        isbn={bookIsbn}
        coverUrl={bookCoverUrl}
      />
      {summary.biography?.hasStructuredData && (
        <section className="yale-overview-tab__section yale-overview-tab__section--summary">
          <BiographySection data={summary.biography} />
        </section>
      )}
      <div id="book-fields-anchor" className="yale-overview-tab__book-fields-anchor">
        <TypeSpecificSection resourceType={resourceType} data={data} summary={summary} entity={entity} />
      </div>
    </>
  )
}

function _renderPlaceContent(
  summary: OverviewTabProps['summary'],
  data: DetailViewModel,
  placeParentLinks: PlaceParentLinkView[],
  resourceType: DetailResourceType,
  entity: Record<string, unknown> | undefined,
): JSX.Element {
  return (
    <>
      <section className="yale-overview-tab__section yale-overview-tab__section--place-hero">
        <h2 className="yale-place-detail__entity-title">{summary.title || data.title || '未命名地点'}</h2>
        {placeParentLinks.length > 0 && (
          <p className="yale-place-detail__entity-parent">
            <span className="yale-place-detail__entity-parent-label">上级区域：</span>
            <span className="yale-place-detail__entity-parent-links">
              {placeParentLinks.map((item, index) => (
                <span key={`${item.name}-${index}`}>
                  <Link to={item.route} className="yale-place-detail__entity-parent-link">
                    {item.name}
                  </Link>
                  {index < placeParentLinks.length - 1 && (
                    <span className="yale-place-detail__entity-parent-sep"> / </span>
                  )}
                </span>
              ))}
            </span>
          </p>
        )}
      </section>
      <TypeSpecificSection resourceType={resourceType} data={data} summary={summary} entity={entity} />
    </>
  )
}

function _renderPoemContent(
  data: DetailViewModel,
  poemAnalysisPayload: {
    title: string
    author: string
    dynasty: string
    fullText: string
    background: string
    creationTime: string
    geoContext: string
  } | null,
): JSX.Element {
  if (!data.poemDetail?.title) return <></>

  return (
    <section className="yale-overview-tab__section yale-overview-tab__section--poem">
      <PoemDetailCard
        poemDetail={data.poemDetail}
        creationTime={poemAnalysisPayload?.creationTime || ''}
      />
    </section>
  )
}

function _renderDefaultContent(
  summary: OverviewTabProps['summary'],
  data: DetailViewModel,
  entity: Record<string, unknown> | undefined,
  resourceType: DetailResourceType,
  isPoemResource: boolean,
  isAncientBookResource: boolean,
  isConceptResource: boolean,
): JSX.Element {
  return (
    <>
      {!isPoemResource && !isAncientBookResource && (
        <section className="yale-overview-tab__section yale-overview-tab__section--summary">
          <h2>{summary.title || data.title || '未命名条目'}</h2>
          {!summary.biography?.hasStructuredData && (
            <p>{summary.snippet || data.summary || '暂无摘要'}</p>
          )}
        </section>
      )}
      {summary.biography?.hasStructuredData && !isAncientBookResource && (
        <section className="yale-overview-tab__section yale-overview-tab__section--summary">
          <BiographySection data={summary.biography} />
        </section>
      )}
      <TypeSpecificSection resourceType={resourceType} data={data} summary={summary} entity={entity} />
      {entity && Object.keys(entity).length > 0 && !isAncientBookResource && !isConceptResource && (
        <section className="yale-overview-tab__section yale-overview-tab__section--metadata">
          <EntityMetadata
            entity={entity}
            showCreators
            showPlaces={false}
            showClassifications={false}
            showPartOf={false}
            showHasPart={false}
            hiddenBasicFieldLabelsZh={isPoemResource ? ['类型'] : []}
            creatorLabelZh={isPoemResource ? '作者' : '创作者'}
            showCreatorRolePrefix={!isPoemResource}
          />
        </section>
      )}
    </>
  )
}

// ============================================================================
// PRIVATE IMPLEMENTATION - Sidebar Accordion Builder
// ============================================================================

interface _SidebarAccordionParams {
  isPersonResource: boolean
  isPoemResource: boolean
  referredContents: string[]
  aiIntroState: AiServiceState
  aiIntro: string
  aiIntroError: string
  refreshAiIntro: () => void
  internalLinks: InternalLinkViewModel[]
  showVectorRelated: boolean
  relatedResources: VectorRelatedItem[]
  relatedState: RelatedState
  showExternalLinks: boolean
  externalUris: string[]
  totalExternalLinks: number
  resourceType: DetailResourceType
  // 诗文 AI 赏析
  poemAiAnalysisState: AiServiceState
  poemAiAnalysis: string
  poemAiAnalysisError: string
  hasFullText: boolean
  refreshPoemAiAnalysis: () => void
}

const PERSON_AI_BODY_CLASS = 'yale-sidebar-accordion__item-body--person-balanced yale-sidebar-accordion__item-body--person-ai'
const PERSON_RELATIONS_BODY_CLASS = 'yale-sidebar-accordion__item-body--person-balanced yale-sidebar-accordion__item-body--person-relations'
const PERSON_RECOMMEND_BODY_CLASS = 'yale-sidebar-accordion__item-body--person-balanced yale-sidebar-accordion__item-body--person-recommend'

function _buildSidebarAccordionItems(params: _SidebarAccordionParams): AccordionItem[] {
  const items: AccordionItem[] = []

  // AI 智能解读 - 仅人物资源显示
  // 智能展开：有成功内容时展开
  if (params.isPersonResource) {
    const hasAiIntroContent = params.aiIntroState === 'success' && params.aiIntro.length > 0
    items.push({
      id: 'ai-intro',
      title: 'AI 智能解读',
      icon: 'bi-cpu',
      defaultExpanded: hasAiIntroContent,
      bodyClassName: params.isPersonResource ? PERSON_AI_BODY_CLASS : undefined,
      content: () => (
        <AiContentRenderer
          hasData={params.referredContents.length > 0}
          state={params.aiIntroState}
          content={params.aiIntro}
          error={params.aiIntroError}
          emptyMessage="暂无可用于生成介绍的人物资料。"
          loadingMessage="正在生成介绍..."
          onRefresh={params.refreshAiIntro}
        />
      ),
    })
  }

  // 相关人物 - 有数据时显示
  // 智能展开：有数据时展开（但优先级低于 AI 内容）
  if (params.isPersonResource && params.internalLinks.length > 0) {
    items.push({
      id: 'internal-links',
      title: '相关人物',
      icon: 'bi-people',
      count: params.internalLinks.length,
      defaultExpanded: false,
      bodyClassName: PERSON_RELATIONS_BODY_CLASS,
      content: () => _renderInternalLinksCardContent(params.internalLinks),
    })
  }

  // AI 赏析 - 仅诗文资源且有全文时显示
  // 智能展开：有成功内容时展开
  if (params.isPoemResource && params.hasFullText) {
    const hasPoemAnalysisContent = params.poemAiAnalysisState === 'success' && params.poemAiAnalysis.length > 0
    items.push({
      id: 'poem-ai-analysis',
      title: 'AI赏析',
      icon: 'bi-robot',
      defaultExpanded: hasPoemAnalysisContent,
      content: () => (
        <AiContentRenderer
          hasData={params.hasFullText}
          state={params.poemAiAnalysisState}
          content={params.poemAiAnalysis}
          error={params.poemAiAnalysisError}
          emptyMessage="当前诗文缺少正文，暂时无法生成赏析。"
          loadingMessage="等待生成赏析..."
          emptyContentMessage={POEM_AI_ANALYSIS_EMPTY_MESSAGE}
          onRefresh={params.refreshPoemAiAnalysis}
        />
      ),
    })
  }

  // 推荐资源 - 有数据时显示
  // 智能展开：有推荐数据且 AI 内容未成功加载时展开
  if (params.showVectorRelated) {
    const hasRelatedContent = params.relatedResources.length > 0
    items.push({
      id: 'related-resources',
      title: '推荐资源',
      icon: 'bi-diagram-3',
      count: params.relatedResources.length,
      defaultExpanded: hasRelatedContent,
      bodyClassName: params.isPersonResource ? PERSON_RECOMMEND_BODY_CLASS : undefined,
      content: () => _renderVectorRelatedCardContent(params.relatedResources, params.relatedState),
    })
  }

  // 外部链接 - 有数据时显示
  // 智能展开：默认收起，用户可手动展开
  if (params.showExternalLinks) {
    items.push({
      id: 'external-links',
      title: '外部链接',
      icon: 'bi-box-arrow-up-right',
      count: params.totalExternalLinks,
      defaultExpanded: params.resourceType === 'ancient_book',
      content: () => _renderExternalLinksCardContent(params.externalUris, params.totalExternalLinks, params.resourceType),
    })
  }

  return items
}

function _renderInternalLinksCardContent(items: InternalLinkViewModel[]): JSX.Element {
  const groupedRelations = _groupByRelationType(items)
  return (
    <div className="yale-sidebar-accordion__related-content">
      {groupedRelations.map((group, index) => (
        <RelationTypeGroup key={group.relationType} group={group} groupIndex={index} />
      ))}
    </div>
  )
}

function _renderVectorRelatedCardContent(
  relatedResources: VectorRelatedItem[],
  relatedState: RelatedState,
): JSX.Element {
  return (
    <div className="yale-sidebar-accordion__related-content">
      {relatedState === 'loading' && (
        <p className="yale-sidebar-accordion__loading">加载中...</p>
      )}
      {relatedState === 'error' && (
        <p className="yale-sidebar-accordion__error">推荐资源加载失败，请稍后重试。</p>
      )}
      {relatedState !== 'loading' && relatedState !== 'error' && relatedResources.length === 0 && (
        <p className="yale-sidebar-accordion__empty">暂无推荐资源</p>
      )}
      {relatedState !== 'loading' && relatedState !== 'error' && relatedResources.length > 0 && (
        <div className="yale-sidebar-accordion__related-list">
          {relatedResources.map((item, index) => (
            <a
              key={`related-${index}`}
              href={`/details?uri=${encodeURIComponent(item.uri)}`}
              className="yale-sidebar-accordion__related-item yale-overview-tab__relation-link"
            >
              <span className="yale-sidebar-accordion__related-title">{item.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function _renderExternalLinksCardContent(
  externalUris: string[],
  totalExternalLinks: number,
  resourceType: DetailResourceType,
): JSX.Element {
  return (
    <div className="yale-sidebar-accordion__external-list yale-overview-tab__external-list">
      {externalUris.slice(0, MAX_EXTERNAL_LINKS).map((uri, index) => (
        <a
          key={index}
          href={uri}
          target="_blank"
          rel="noopener noreferrer"
          className="yale-sidebar-accordion__external-link yale-overview-tab__external-link"
        >
          <i className="bi bi-box-arrow-up-right" />
          <span>{getExternalSourceLabel(uri, resourceType)}</span>
        </a>
      ))}
      {externalUris.length > MAX_EXTERNAL_LINKS && (
        <p className="yale-sidebar-accordion__more">
          还有 {externalUris.length - MAX_EXTERNAL_LINKS} 个外部链接...
        </p>
      )}
    </div>
  )
}
