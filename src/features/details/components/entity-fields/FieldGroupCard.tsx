import type { FieldGroup } from './types'

interface FieldGroupCardProps {
  group: FieldGroup
}

function isLongText(value: string): boolean {
  const normalized = String(value || '').trim()
  if (!normalized) return false
  return normalized.length >= 48 || normalized.includes('。') || normalized.includes('；')
}

export function FieldGroupCard({ group }: FieldGroupCardProps): JSX.Element {
  return (
    <section className="yale-overview-tab__section yale-overview-tab__section--type">
      <h3 className="yale-overview-tab__type-title">{group.title}</h3>
      <div className="yale-overview-tab__type-grid">
        {group.rows.map((row, index) => (
          <div
            key={`${group.title}-${index}`}
            className={`yale-overview-tab__type-item ${isLongText(row.value) ? 'yale-overview-tab__type-item--long' : ''}`.trim()}
          >
            <span className="yale-overview-tab__type-label">{row.label}</span>
            {row.path ? (
              <a
                href={row.path}
                target="_blank"
                rel="noopener noreferrer"
                className="yale-overview-tab__type-link"
              >
                {row.value}
              </a>
            ) : (
              <span className="yale-overview-tab__type-value">{row.value}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
