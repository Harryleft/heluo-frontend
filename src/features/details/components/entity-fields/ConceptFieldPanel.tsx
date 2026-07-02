import { useMemo } from 'react'
import { FieldGroupCard } from './FieldGroupCard'
import { parseConceptFieldGroups } from './parsers'

interface ConceptFieldPanelProps {
  entity: Record<string, unknown>
}

export function ConceptFieldPanel({ entity }: ConceptFieldPanelProps): JSX.Element | null {
  const groups = useMemo(() => parseConceptFieldGroups(entity), [entity])
  if (!groups.length) return null

  return (
    <>
      {groups.map((group) => (
        <FieldGroupCard key={group.title} group={group} />
      ))}
    </>
  )
}
