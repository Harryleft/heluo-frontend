import { useMemo } from 'react'
import { PlaceCoordinateMapPanel } from './PlaceCoordinateMapPanel'
import { PlaceHistoryTimelineChart } from './PlaceHistoryTimelineChart'
import { asArray, asRecord, pickNodeText } from './utils'

interface PlaceFieldPanelProps {
  entity: Record<string, unknown>
}

interface PlaceTimelineItem {
  name: string
  time: string
}

function extractPlaceTimeline(entity: Record<string, unknown>): PlaceTimelineItem[] {
  const nodes = asArray(entity.attributed_by).map((item) => asRecord(item))
  const timeline = nodes
    .map((node) => ({
      name: pickNodeText(node._label || node),
      time: pickNodeText(node.timespan),
    }))
    .filter((item) => item.name)

  const dedupe = new Set<string>()
  return timeline.filter((item) => {
    const key = `${item.name}::${item.time}`
    if (dedupe.has(key)) return false
    dedupe.add(key)
    return true
  })
}

export function PlaceFieldPanel({ entity }: PlaceFieldPanelProps): JSX.Element | null {
  const timeline = useMemo(() => extractPlaceTimeline(entity), [entity])

  return (
    <>
      {timeline.length > 0 && (
        <section className="yale-overview-tab__section yale-place-card yale-place-card--timeline">
          <h3 className="yale-place-detail__title">历史演变过程</h3>
          <PlaceHistoryTimelineChart items={timeline} />
        </section>
      )}

      <PlaceCoordinateMapPanel entity={entity} />
    </>
  )
}
