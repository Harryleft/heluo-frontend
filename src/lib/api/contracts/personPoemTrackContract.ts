import type {
  HistoricalName,
  PersonPoemTrack,
  PoemTrackPoint,
  TrackPoem,
} from '@/types/contracts/poemTrackContracts'
import { isWgs84Coordinate } from '@/lib/geo/wkt'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableYear(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isHistoricalName(value: unknown): value is HistoricalName {
  return isRecord(value) && isString(value.name) && isString(value.period)
}

function isTrackPoem(value: unknown): value is TrackPoem {
  return isRecord(value) && isString(value.id) && isString(value.title) && isString(value.uri)
}

function isPoemTrackPoint(value: unknown): value is PoemTrackPoint {
  if (!isRecord(value) || !isFiniteNumber(value.year) || !isString(value.yearLabel)) return false
  if (!Array.isArray(value.poems) || !value.poems.every(isTrackPoem)) return false
  if (!isRecord(value.place)) return false
  if (!isString(value.place.uri) || !isString(value.place.label)) return false
  if (!isWgs84Coordinate(value.place.lng, value.place.lat)) return false
  return (
    value.place.historicalNames === undefined ||
    (Array.isArray(value.place.historicalNames) && value.place.historicalNames.every(isHistoricalName))
  )
}

export function isPersonPoemTrack(value: unknown): value is PersonPoemTrack {
  if (!isRecord(value)) return false
  if (!isString(value.personId) || !isString(value.personName)) return false
  if (value.dynasty !== undefined && !isString(value.dynasty)) return false

  const lifespan = value.lifespan
  if (
    !isRecord(lifespan) ||
    !isNullableYear(lifespan.birth) ||
    !isNullableYear(lifespan.death) ||
    !isString(lifespan.label)
  ) {
    return false
  }

  if (!Array.isArray(value.trackPoints) || !value.trackPoints.every(isPoemTrackPoint)) return false
  if (
    !Array.isArray(value.undatedPoems) ||
    !value.undatedPoems.every(
      (poem) => isRecord(poem) && isString(poem.id) && isString(poem.title) && isString(poem.uri),
    )
  ) {
    return false
  }

  const stats = value.stats
  if (
    !isRecord(stats) ||
    !isFiniteNumber(stats.totalPoems) ||
    !isFiniteNumber(stats.datedPoems) ||
    !isFiniteNumber(stats.placesCount)
  ) {
    return false
  }
  if (stats.yearRange === null) return true
  return (
    isRecord(stats.yearRange) &&
    isFiniteNumber(stats.yearRange.start) &&
    isFiniteNumber(stats.yearRange.end)
  )
}
