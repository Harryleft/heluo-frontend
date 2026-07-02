import { useEffect, useMemo, useRef } from 'react'
import { Timeline } from 'vis-timeline/standalone'
import type { DataItem, TimelineOptions } from 'vis-timeline'
import 'vis-timeline/styles/vis-timeline-graph2d.min.css'

interface PlaceHistoryTimelineChartItem {
  name: string
  time: string
}

interface PlaceHistoryTimelineChartProps {
  items: PlaceHistoryTimelineChartItem[]
}

type TimelineEra = 'BCE' | 'CE'

interface TimelineYearToken {
  year: number
  era: TimelineEra | null
}

interface TimelineRange {
  startYear: number
  endYear: number
  hasRange: boolean
}

interface TimelineEntry extends PlaceHistoryTimelineChartItem {
  startYear: number
  endYear: number
  hasRange: boolean
  order: number
}

function parseTimeYearTokens(timeText: string): TimelineYearToken[] {
  const source = String(timeText || '').trim()
  if (!source) return []

  const tokens: TimelineYearToken[] = []
  const regex = /(\d{1,4})\s*(BCE|BC|CE|AD)?/gi
  let match = regex.exec(source)
  while (match) {
    const year = Number(match[1])
    if (Number.isFinite(year)) {
      const eraRaw = String(match[2] || '').toUpperCase()
      const era: TimelineEra | null = eraRaw === 'BCE' || eraRaw === 'BC'
        ? 'BCE'
        : eraRaw === 'CE' || eraRaw === 'AD'
          ? 'CE'
          : null
      tokens.push({ year, era })
    }
    match = regex.exec(source)
  }
  return tokens
}

function inferEraFromText(timeText: string): TimelineEra | null {
  const source = String(timeText || '').toUpperCase()
  if (source.includes('BCE') || source.includes('BC')) return 'BCE'
  if (source.includes('CE') || source.includes('AD')) return 'CE'
  return null
}

function toAbsoluteYear(token: TimelineYearToken, fallbackEra: TimelineEra): number {
  const era = token.era || fallbackEra
  return era === 'BCE' ? -token.year : token.year
}

function parseTimeRange(timeText: string): TimelineRange | null {
  const source = String(timeText || '').trim()
  if (!source) return null

  const normalized = source
    .replace(/circa|ca\.?|约|前后/gi, ' ')
    .replace(/[—–~～至到]+/g, '-')
  const tokens = parseTimeYearTokens(normalized)
  if (!tokens.length) return null

  const inferredEra = inferEraFromText(normalized) || 'CE'
  if (tokens.length === 1) {
    const year = toAbsoluteYear(tokens[0], inferredEra)
    return { startYear: year, endYear: year, hasRange: false }
  }

  const first = tokens[0]
  const second = tokens[1]
  const secondEra = second.era || inferredEra
  const firstEra = first.era || secondEra

  const startYear = toAbsoluteYear(first, firstEra)
  const endYear = toAbsoluteYear(second, secondEra)
  if (startYear <= endYear) {
    return { startYear, endYear, hasRange: true }
  }
  return { startYear: endYear, endYear: startYear, hasRange: true }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function toTimelineDate(year: number): Date {
  const safeYear = Math.max(-9999, Math.min(9999, year))
  const date = new Date(Date.UTC(0, 0, 1))
  date.setUTCFullYear(safeYear, 0, 1)
  return date
}

function buildTimelineEntries(items: PlaceHistoryTimelineChartItem[]): TimelineEntry[] {
  if (!items.length) return []

  const raw = items.map((item, index) => {
    const parsed = parseTimeRange(item.time)
    return {
      ...item,
      startYear: parsed?.startYear ?? 0,
      endYear: parsed?.endYear ?? 0,
      hasRange: parsed?.hasRange ?? false,
      order: index,
      parsed,
    }
  })

  const maxKnownYear = raw.reduce((max, item) => {
    if (!item.parsed) return max
    return Math.max(max, item.endYear)
  }, 1)
  let fallbackYear = maxKnownYear

  return raw.map((item) => {
    if (item.parsed) {
      return {
        name: item.name,
        time: item.time,
        startYear: item.startYear,
        endYear: item.endYear,
        hasRange: item.hasRange,
        order: item.order,
      }
    }
    fallbackYear += 1
    return {
      name: item.name,
      time: item.time,
      startYear: fallbackYear,
      endYear: fallbackYear,
      hasRange: false,
      order: item.order,
    }
  }).sort((left, right) => {
    if (left.startYear !== right.startYear) return left.startYear - right.startYear
    if (left.endYear !== right.endYear) return left.endYear - right.endYear
    return left.order - right.order
  })
}

function buildTimelineDataItems(entries: TimelineEntry[]): DataItem[] {
  return entries.map((entry, index) => {
    const isRange = entry.hasRange && entry.endYear !== entry.startYear
    const safeName = escapeHtml(entry.name)
    const safeTime = escapeHtml(entry.time || '未标注时间')
    const content = `<div style="display:flex;flex-direction:column;gap:2px;min-width:${isRange ? 128 : 98}px;">
      <span style="font-weight:600;color:#3f3324;">${safeName}</span>
      <span style="font-size:12px;color:#7c6d5a;">${safeTime}</span>
    </div>`
    const base: DataItem = {
      id: `${index}-${entry.name}-${entry.startYear}-${entry.endYear}`,
      start: toTimelineDate(entry.startYear),
      content,
      title: entry.time || '未标注时间',
    }
    if (isRange) {
      return {
        ...base,
        type: 'range',
        end: toTimelineDate(entry.endYear + 1),
      }
    }
    return base
  })
}

const TIMELINE_OPTIONS: TimelineOptions = {
  stack: true,
  moveable: true,
  zoomable: true,
  selectable: false,
  showCurrentTime: false,
  orientation: 'top',
  horizontalScroll: true,
  maxHeight: 320,
  minHeight: 240,
  margin: { item: 14, axis: 10 },
  zoomMin: 1000 * 60 * 60 * 24 * 365,
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 5000,
}

export function PlaceHistoryTimelineChart({ items }: PlaceHistoryTimelineChartProps): JSX.Element | null {
  const entries = useMemo(() => buildTimelineEntries(items), [items])
  const timelineItems = useMemo(() => buildTimelineDataItems(entries), [entries])
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !timelineItems.length) return

    const timeline = new Timeline(container, timelineItems, TIMELINE_OPTIONS)
    timeline.fit({ animation: false })

    return () => {
      timeline.destroy()
    }
  }, [timelineItems])

  if (!timelineItems.length) return null

  return (
    <div className="yale-place-history-chart" aria-label="历史演变过程时间轴">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.45rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#7c6d5a' }}>
          可滚轮缩放与拖拽浏览
        </span>
      </div>
      <div ref={containerRef} className="yale-place-history-chart__timeline" />
    </div>
  )
}
