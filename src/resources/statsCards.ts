type StatCard = {
  label: string
  key: string
  scope: string
}

const STATS_CARDS_CONFIG: ReadonlyArray<StatCard> = [
  { label: '人物', key: 'person', scope: 'person' },
  { label: '诗文集', key: 'poemSet', scope: 'poem' },
  { label: '图书', key: 'book', scope: 'book' },
  { label: '古籍', key: 'ancientBook', scope: 'ancient_book' },
  { label: '地理', key: 'geography', scope: 'place' },
  { label: '概念', key: 'concept', scope: 'concept' },
]

export const STATS_CARDS: StatCard[] = [...STATS_CARDS_CONFIG]
