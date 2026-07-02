import { useMemo } from 'react'
import { parseBookFieldGroups } from './parsers'
import { FieldGroupCard } from './FieldGroupCard'
import { BookLocationMapPanel } from './BookLocationMapPanel'

interface BookFieldPanelProps {
  entity: Record<string, unknown>
  summarySnippet?: string
}

export function BookFieldPanel({ entity, summarySnippet = '' }: BookFieldPanelProps): JSX.Element | null {
  const groups = useMemo(
    () => parseBookFieldGroups(entity, { summarySnippet }),
    [entity, summarySnippet],
  )
  if (!groups.length) {
    return <BookLocationMapPanel entity={entity} />
  }

  return (
    <>
      {groups.map((group) => (
        <FieldGroupCard key={group.title} group={group} />
      ))}
      <BookLocationMapPanel entity={entity} />
    </>
  )
}
