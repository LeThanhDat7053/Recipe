import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Home from './pages/Home'
import Categories from './pages/Categories'
import CategoryDetail from './pages/CategoryDetail'
import Search from './pages/Search'
import Shopping from './pages/Shopping'
import RecipeDetail from './pages/RecipeDetail'
import NotFound from './pages/NotFound'

// Trang ít dùng hơn -> tách chunk, tải khi cần
const RecipeEdit = lazy(() => import('./pages/RecipeEdit'))
const CookMode = lazy(() => import('./pages/CookMode'))
const Account = lazy(() => import('./pages/Account'))
const Fridge = lazy(() => import('./pages/Fridge'))
const Trash = lazy(() => import('./pages/Trash'))
const Shared = lazy(() => import('./pages/Shared'))
const Expenses = lazy(() => import('./pages/Expenses'))

export const router = createBrowserRouter([
  // Link chia sẻ công khai: xem được khi chưa đăng nhập
  {
    path: '/s/:shareId',
    element: (
      <Suspense fallback={<Spinner className="pt-40" />}>
        <Shared />
      </Suspense>
    ),
  },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/categories', element: <Categories /> },
      { path: '/categories/:id', element: <CategoryDetail kind="category" /> },
      { path: '/collections/:id', element: <CategoryDetail kind="collection" /> },
      { path: '/search', element: <Search /> },
      { path: '/shopping', element: <Shopping /> },
      { path: '/expenses', element: <Expenses /> },
      { path: '/fridge', element: <Fridge /> },
      { path: '/account', element: <Account /> },
      { path: '/trash', element: <Trash /> },
      { path: '/recipe/new', element: <RecipeEdit />, handle: { hideNav: true } },
      { path: '/recipe/:id', element: <RecipeDetail />, handle: { hideNav: true } },
      { path: '/recipe/:id/edit', element: <RecipeEdit />, handle: { hideNav: true } },
      { path: '/recipe/:id/cook', element: <CookMode />, handle: { hideNav: true, hideTimers: true } },
      { path: '*', element: <NotFound /> },
    ],
  },
])
