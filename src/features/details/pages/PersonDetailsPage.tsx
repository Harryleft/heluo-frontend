import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { DetailPageContainer } from '@/features/details/components/DetailPageContainer'
import { PersonPoemTrackMap } from '@/features/details/components/PersonPoemTrackMap'
import { useDetailPageViewModel } from '@/features/details/hooks/useDetailPageViewModel'

/**
 * 从 URI 中提取人物 ID
 *
 * @param uri - 人物 URI，如 "/person/17270" 或 "/processed/json-ld/person/17270.json"
 * @returns 人物 ID，如 "17270"
 */
function extractPersonIdFromUri(uri: string): string | null {
  if (!uri) return null

  // 匹配 /person/xxx 或 http://.../person/xxx 格式
  const match = uri.match(/\/person\/([^/?#]+)/i)
  if (!match) return null

  // 去掉可能的 .json 后缀
  const id = match[1]
  return id.replace(/\.json$/i, '')
}

/**
 * PersonDetailsPage 人物详情页面
 *
 * 专门用于显示人物类型的详情信息，包含：
 * - 人物基本信息
 * - 诗文地理轨迹地图
 *
 * @example
 * ```tsx
 * // 访问路径: /details?uri=/person/xxx
 * <PersonDetailsPage />
 * ```
 */
export function PersonDetailsPage(): JSX.Element {
  const viewModel = useDetailPageViewModel()
  const navigate = useNavigate()

  // 从 URI 中提取人物 ID
  const personId = useMemo(() => extractPersonIdFromUri(viewModel.uri), [viewModel.uri])

  // 处理诗文点击：跳转到诗文详情页
  const handlePoemClick = useCallback((poem: { id: string; title: string; uri: string }) => {
    navigate(`/details?uri=${encodeURIComponent(poem.uri)}`)
  }, [navigate])

  // 人物诗文轨迹区域
  const poemTrackSection = useMemo(() => {
    // 如果没有有效的人物 ID，不显示轨迹地图
    if (!personId) return null

    return (
      <Box>
        <PersonPoemTrackMap
          key={`amap-${personId}`}
          personId={personId}
          onPoemClick={handlePoemClick}
        />
      </Box>
    )
  }, [personId, handlePoemClick])

  return <DetailPageContainer resourceType="person" viewModel={viewModel} bottomContent={poemTrackSection} />
}
