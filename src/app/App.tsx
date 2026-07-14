import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { HomePageClassic } from '@/features/home/HomePageClassic'
import { ResultsPage } from '@/features/results/ResultsPage'
import { DetailsRouter } from '@/features/details/DetailsRouter'
import { IiifPage } from '@/features/iiif/IiifPage'
import { FusionChatPage } from '@/features/fusion/FusionChatPage'
import { GlobalHeader, shouldShowGlobalHeader } from '@/features/common/GlobalHeader'
import { BreadcrumbNav } from '@/features/common/BreadcrumbNav'
import { TopicPage } from '@/features/topics/TopicPage'
import { DUFU_TOPIC } from '@/features/topics/topicData'

const APP_ROUTES = [
  { path: '/', element: <HomePageClassic /> },
  { path: '/results', element: <ResultsPage /> },
  { path: '/chat', element: <FusionChatPage /> },
  { path: '/details', element: <DetailsRouter /> },
  { path: '/iiif', element: <IiifPage /> },
  { path: '/mirador', element: <IiifPage /> },
  { path: '/topics/dufu-from-gongxian', element: <TopicPage topic={DUFU_TOPIC} /> },
] as const

/**
 * 带全局 Header 的布局组件
 */
function LayoutWithHeader({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <GlobalHeader />
      <BreadcrumbNav />
      {children}
    </>
  )
}

/**
 * 路由包装器 - 根据路径决定是否显示全局 Header
 */
function RouteWrapper({ element, showHeader }: { element: JSX.Element; showHeader: boolean }): JSX.Element {
  if (showHeader) {
    return <LayoutWithHeader>{element}</LayoutWithHeader>
  }
  return element
}

/**
 * 根据 location 判断路由是否需要显示 Header
 */
function AppRoutes(): JSX.Element {
  const location = useLocation()
  const showHeader = shouldShowGlobalHeader(location.pathname)

  return (
    <Routes>
      {APP_ROUTES.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <RouteWrapper
              element={route.element}
              showHeader={showHeader}
            />
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App(): JSX.Element {
  return <AppRoutes />
}
