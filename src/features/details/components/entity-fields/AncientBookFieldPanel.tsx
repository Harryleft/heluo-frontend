import { useMemo } from 'react'
import { parseAncientBookFieldGroups } from './parsers'

interface AncientBookFieldPanelProps {
  entity: Record<string, unknown>
  digitalResourceCount?: number
}

export function AncientBookFieldPanel({
  entity,
  digitalResourceCount,
}: AncientBookFieldPanelProps): JSX.Element | null {
  const groups = useMemo(
    () => parseAncientBookFieldGroups(entity, { digitalResourceCount }),
    [entity, digitalResourceCount],
  )

  if (!groups.length) return null

  const rows = groups.flatMap((group) => group.rows)

  return (
    <section className="yale-overview-tab__section yale-overview-tab__section--type">
      <div className="yale-overview-tab__type-grid">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="yale-overview-tab__type-item">
            <span className="yale-overview-tab__type-label">{row.label}</span>
            <span className="yale-overview-tab__type-value">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
