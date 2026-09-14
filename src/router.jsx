import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Categories from './pages/Categories'
import CategoryDetail from './pages/CategoryDetail'
import Search from './pages/Search'
import RecipeDetail from './pages/RecipeDetail'
import NotFound from './pages/NotFound'

// Trang ít dùng hơn -> tách chunk, tải khi cần
const RecipeEdit = lazy(() => import('./pages/RecipeEdit'))
const Account = lazy(() => import('./pages/Account'))

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/categories', element: <Categories /> },
      { path: '/categories/:id', element: <CategoryDetail /> },
      { path: '/search', element: <Search /> },
      { path: '/account', element: <Account /> },
      { path: '/recipe/new', element: <RecipeEdit />, handle: { hideNav: true } },
      { path: '/recipe/:id', element: <RecipeDetail />, handle: { hideNav: true } },
      { path: '/recipe/:id/edit', element: <RecipeEdit />, handle: { hideNav: true } },
      { path: '*', element: <NotFound /> },
    ],
  },
])
