interface AncientBookVolumeTextSectionProps {
  label?: string
  text?: string
  status?: 'available' | 'missing'
  message?: string
  sourceUri?: string
}

const SECTION_STYLE = { marginBottom: '1rem' }
const TITLE_STYLE = { marginBottom: '0.75rem' }
const TEXT_STYLE = {
  maxHeight: '28rem',
  overflowY: 'auto',
  whiteSpace: 'pre-wrap',
  lineHeight: 1.85,
  fontSize: '0.96rem',
} as const
const SOURCE_STYLE = { marginTop: '0.75rem', marginBottom: 0 }
const EMPTY_TEXT = '暂无文本内容'
const BASE_TITLE = '当前卷文本'

function buildTitle(label?: string): string {
  if (!label) return BASE_TITLE
  return `${BASE_TITLE}：${label}`
}

function renderTextBlock(text?: string): JSX.Element {
  return <div style={TEXT_STYLE}>{text || EMPTY_TEXT}</div>
}

export function AncientBookVolumeTextSection({
  label,
  text,
  status,
  message,
  sourceUri,
}: AncientBookVolumeTextSectionProps): JSX.Element | null {
  if (!status && !text && !message) return null

  const title = buildTitle(label)
  const hasMissingText = status === 'missing'
  if (hasMissingText && !text) return null

  return (
    <section className="panel" style={SECTION_STYLE}>
      <h3 style={TITLE_STYLE}>{title}</h3>
      {renderTextBlock(text)}

      {sourceUri ? (
        <p className="muted" style={SOURCE_STYLE}>
          文本来源：{sourceUri}
        </p>
      ) : null}
    </section>
  )
}
