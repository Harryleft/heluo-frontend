import React from 'react'
import { EntityParser, type MetadataField, type CreatorInfo, type PlaceInfo, type ClassificationInfo } from '@/lib/parse/data/EntityParser'
import { buildDetailsRouteFromUri } from '@/lib/url/heluoUrl'
import entityMetadataStyles from '@/styles/features/common/EntityMetadata'
import InternalLink from './InternalLink'
import { Link } from 'react-router-dom'
import { injectStyles } from '@/lib/dom/injectStyles'

const EMPTY_LABELS: string[] = []

/**
 * 语言偏好类型
 */
type LanguagePreference = 'zh' | 'en'

/**
 * EntityMetadata 组件属性
 */
interface EntityMetadataProps {
  /** 实体数据对象 */
  entity: Record<string, unknown>
  /** 语言偏好（默认中文） */
  language?: LanguagePreference
  /** 自定义类名 */
  className?: string
  /** 空状态时的提示文本 */
  emptyMessage?: string
  /** 是否显示英文字段标签 */
  showEnglishLabels?: boolean
  /** 是否显示创作者列表 */
  showCreators?: boolean
  /** 是否显示地点列表 */
  showPlaces?: boolean
  /** 是否显示分类列表 */
  showClassifications?: boolean
  /** 是否显示所属集合 */
  showPartOf?: boolean
  /** 是否显示包含部分 */
  showHasPart?: boolean
  /** 是否显示 IIIF 清单链接 */
  showIIIFManifests?: boolean
  /** 是否显示数字对象源 */
  showDigitalSources?: boolean
  /** 隐藏的基础字段中文标签 */
  hiddenBasicFieldLabelsZh?: string[]
  /** 创作者行中文标签 */
  creatorLabelZh?: string
  /** 创作者值是否显示角色前缀 */
  showCreatorRolePrefix?: boolean
}

/**
 * 获取字段标签
 */
function getFieldLabel(field: MetadataField, language: LanguagePreference, showEnglish: boolean): string {
  const labels: string[] = []

  if (language === 'zh' || (!showEnglish && language === 'en')) {
    labels.push(field.labelZh)
  }

  if (language === 'en' || showEnglish) {
    labels.push(field.labelEn)
  }

  // 如果双语，则用斜杠分隔
  return labels.filter(Boolean).join(' / ')
}

function getBilingualLabel(
  labelZh: string,
  labelEn: string,
  language: LanguagePreference,
  showEnglishLabels: boolean,
): string {
  return showEnglishLabels ? `${labelZh} / ${labelEn}` : (language === 'zh' ? labelZh : labelEn)
}

function renderExternalUriList(uris: string[]): JSX.Element {
  return (
    <ul className="entity-metadata__list">
      {uris.map((uri) => (
        <li key={uri} className="entity-metadata__list-item">
          <a href={uri} target="_blank" rel="noopener noreferrer" className="entity-metadata__link">
            {uri}
          </a>
        </li>
      ))}
    </ul>
  )
}

function renderImageUriList(uris: string[]): JSX.Element {
  return (
    <ul className="entity-metadata__list">
      {uris.map((uri) => (
        <li key={uri} className="entity-metadata__list-item">
          <img src={uri} alt="" className="entity-metadata__image" loading="lazy" />
        </li>
      ))}
    </ul>
  )
}

/**
 * 元数据行组件
 */
interface MetadataRowProps {
  field: MetadataField
  language: LanguagePreference
  showEnglishLabels: boolean
}

function MetadataRow({ field, language, showEnglishLabels }: MetadataRowProps): JSX.Element {
  const label = getFieldLabel(field, language, showEnglishLabels)

  // 如果字段有 URI，显示为可点击的链接
  const renderValue = () => {
    if (field.uri) {
      const internalRoute = buildDetailsRouteFromUri(field.uri)
      if (internalRoute) {
        return (
          <Link to={internalRoute} className="entity-metadata__link">
            {field.value}
          </Link>
        )
      }
      // 其他外部 URI
      return (
        <a href={field.uri} target="_blank" rel="noopener noreferrer" className="entity-metadata__link">
          {field.value}
        </a>
      )
    }
    return field.value
  }

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">{renderValue()}</td>
    </tr>
  )
}

/**
 * EntityMetadata 实体元数据组件
 *
 * 显示实体的详细元数据信息，包括类型、日期、地点、国籍等。
 * 只显示有值的字段，支持中英文双语标签。
 *
 * @example
 * ```tsx
 * <EntityMetadata entity={entityData} />
 *
 * // 使用英文标签
 * <EntityMetadata entity={entityData} language="en" />
 *
 * // 显示双语标签
 * <EntityMetadata entity={entityData} showEnglishLabels />
 *
 * // 显示扩展信息
 * <EntityMetadata entity={entityData} showCreators showPlaces />
 * ```
 */
export const EntityMetadata: React.FC<EntityMetadataProps> = ({
  entity,
  language = 'zh',
  className = '',
  emptyMessage = '暂无详细信息。',
  showEnglishLabels = false,
  showCreators = true,
  showPlaces = true,
  showClassifications = true,
  showPartOf = true,
  showHasPart = true,
  showIIIFManifests = false,
  showDigitalSources = false,
  hiddenBasicFieldLabelsZh = EMPTY_LABELS,
  creatorLabelZh = '创作者',
  showCreatorRolePrefix = true,
}) => {
  // 注入样式
  injectStyles('entity-metadata', entityMetadataStyles)

  const { metadataArray, metadata } = React.useMemo(() => {
    const parser = new EntityParser(entity)
    const hiddenLabels = new Set(hiddenBasicFieldLabelsZh.map((item) => String(item || '').trim()).filter(Boolean))

    return {
      metadataArray: parser.getMetadataArray().filter((field) => !hiddenLabels.has(String(field.labelZh || '').trim())),
      metadata: parser.getMetadata(),
    }
  }, [entity, hiddenBasicFieldLabelsZh])

  // 如果没有元数据，显示空状态
  if (metadataArray.length === 0 &&
      !metadata.creators?.length &&
      !metadata.places?.length &&
      !metadata.classifications?.length &&
      !metadata.partOf?.length &&
      !metadata.hasPart?.length &&
      !metadata.iiifManifests?.length &&
      !metadata.digitalSources?.length) {
    return (
      <div className={`entity-metadata ${className}`.trim()}>
        <div className="entity-metadata__empty">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className={`entity-metadata ${className}`.trim()}>
      <table className="entity-metadata__table">
        <tbody>
          {/* 基础元数据字段 */}
          {metadataArray.map((field, index) => (
            <MetadataRow
              key={`basic-${field.labelEn}-${index}`}
              field={field}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          ))}

          {/* 创作者列表 */}
          {showCreators && metadata.creators && metadata.creators.length > 0 && (
            <CreatorsRow
              creators={metadata.creators}
              language={language}
              showEnglishLabels={showEnglishLabels}
              creatorLabelZh={creatorLabelZh}
              showRolePrefix={showCreatorRolePrefix}
            />
          )}

          {/* 地点列表 */}
          {showPlaces && metadata.places && metadata.places.length > 0 && (
            <PlacesRow
              places={metadata.places}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          )}

          {/* 分类列表 */}
          {showClassifications && metadata.classifications && metadata.classifications.length > 0 && (
            <ClassificationsRow
              classifications={metadata.classifications}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          )}

          {/* 所属集合 */}
          {showPartOf && metadata.partOf && metadata.partOf.length > 0 && (
            <PartOfRow
              partOf={metadata.partOf}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          )}

          {/* 包含部分 */}
          {showHasPart && metadata.hasPart && metadata.hasPart.length > 0 && (
            <HasPartRow
              hasPart={metadata.hasPart}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          )}

          {/* IIIF 清单 */}
          {showIIIFManifests && metadata.iiifManifests && metadata.iiifManifests.length > 0 && (
            <IIIFManifestsRow
              manifests={metadata.iiifManifests}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          )}

          {/* 数字对象源 */}
          {showDigitalSources && metadata.digitalSources && metadata.digitalSources.length > 0 && (
            <DigitalSourcesRow
              sources={metadata.digitalSources}
              language={language}
              showEnglishLabels={showEnglishLabels}
            />
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 创作者行组件
 */
interface CreatorsRowProps {
  creators: CreatorInfo[]
  language: LanguagePreference
  showEnglishLabels: boolean
  creatorLabelZh: string
  showRolePrefix: boolean
}

function CreatorsRow({
  creators,
  language,
  showEnglishLabels,
  creatorLabelZh,
  showRolePrefix,
}: CreatorsRowProps): JSX.Element {
  const labelZh = creatorLabelZh || '创作者'
  const labelEn = 'Creators'
  const label = showEnglishLabels ? `${labelZh} / ${labelEn}` : (language === 'zh' ? labelZh : labelEn)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">
        <ul className="entity-metadata__list">
          {creators.map((creator) => (
            <li key={creator.uri} className="entity-metadata__list-item">
              <InternalLink uri={creator.uri}>
                {showRolePrefix && creator.role ? `${creator.role}: ` : ''}{creator.label}
              </InternalLink>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  )
}

/**
 * 地点行组件
 */
interface PlacesRowProps {
  places: PlaceInfo[]
  language: LanguagePreference
  showEnglishLabels: boolean
}

function PlacesRow({ places, language, showEnglishLabels }: PlacesRowProps): JSX.Element {
  const labelZh = '地点'
  const labelEn = 'Places'
  const label = showEnglishLabels ? `${labelZh} / ${labelEn}` : (language === 'zh' ? labelZh : labelEn)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">
        <ul className="entity-metadata__list">
          {places.map((place) => (
            <li key={place.uri || place.label} className="entity-metadata__list-item">
              {place.uri ? (
                <InternalLink uri={place.uri}>{place.label}</InternalLink>
              ) : (
                <span>{place.label}</span>
              )}
            </li>
          ))}
        </ul>
      </td>
    </tr>
  )
}

/**
 * 分类行组件
 */
interface ClassificationsRowProps {
  classifications: ClassificationInfo[]
  language: LanguagePreference
  showEnglishLabels: boolean
}

function ClassificationsRow({ classifications, language, showEnglishLabels }: ClassificationsRowProps): JSX.Element {
  const labelZh = '分类'
  const labelEn = 'Classifications'
  const label = showEnglishLabels ? `${labelZh} / ${labelEn}` : (language === 'zh' ? labelZh : labelEn)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">
        <ul className="entity-metadata__list">
          {classifications.map((classification) => (
            <li key={classification.uri} className="entity-metadata__list-item">
              <InternalLink uri={classification.uri}>{classification.label}</InternalLink>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  )
}

/**
 * 所属集合行组件
 */
interface PartOfRowProps {
  partOf: Array<{ uri: string; label: string }>
  language: LanguagePreference
  showEnglishLabels: boolean
}

function PartOfRow({ partOf, language, showEnglishLabels }: PartOfRowProps): JSX.Element {
  const labelZh = '所属集合'
  const labelEn = 'Part Of'
  const label = showEnglishLabels ? `${labelZh} / ${labelEn}` : (language === 'zh' ? labelZh : labelEn)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">
        <ul className="entity-metadata__list">
          {partOf.map((item) => (
            <li key={item.uri} className="entity-metadata__list-item">
              <InternalLink uri={item.uri}>{item.label}</InternalLink>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  )
}

/**
 * 包含部分行组件
 */
interface HasPartRowProps {
  hasPart: Array<{ uri: string; label: string }>
  language: LanguagePreference
  showEnglishLabels: boolean
}

function HasPartRow({ hasPart, language, showEnglishLabels }: HasPartRowProps): JSX.Element {
  const labelZh = '包含部分'
  const labelEn = 'Has Parts'
  const label = showEnglishLabels ? `${labelZh} / ${labelEn}` : (language === 'zh' ? labelZh : labelEn)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">
        <ul className="entity-metadata__list">
          {hasPart.map((item) => (
            <li key={item.uri} className="entity-metadata__list-item">
              <InternalLink uri={item.uri}>{item.label}</InternalLink>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  )
}

/**
 * IIIF 清单行组件
 */
interface IIIFManifestsRowProps {
  manifests: string[]
  language: LanguagePreference
  showEnglishLabels: boolean
}

function IIIFManifestsRow({ manifests, language, showEnglishLabels }: IIIFManifestsRowProps): JSX.Element {
  const label = getBilingualLabel('IIIF 清单', 'IIIF Manifests', language, showEnglishLabels)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">{renderExternalUriList(manifests)}</td>
    </tr>
  )
}

/**
 * 数字对象源行组件
 */
interface DigitalSourcesRowProps {
  sources: string[]
  language: LanguagePreference
  showEnglishLabels: boolean
}

function DigitalSourcesRow({ sources, language, showEnglishLabels }: DigitalSourcesRowProps): JSX.Element {
  const label = getBilingualLabel('数字对象', 'Digital Sources', language, showEnglishLabels)

  return (
    <tr className="entity-metadata__row">
      <th className="entity-metadata__label" scope="row">
        {label}
      </th>
      <td className="entity-metadata__value">{renderImageUriList(sources)}</td>
    </tr>
  )
}
