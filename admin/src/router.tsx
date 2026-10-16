import { createBrowserRouter, Navigate } from 'react-router';
import { AdminLayout } from './components/AdminLayout';
import { RequireAdmin } from './auth/RequireAdmin';
import { LoginPage } from './pages/LoginPage';
import { ModelsPage } from './pages/ModelsPage';
import { ModelEditPage } from './pages/ModelEditPage';
import { PalettesPage } from './pages/PalettesPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { UiKitPage } from './pages/UiKitPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '*', element: <NotFoundPage /> },
  {
    path: '/',
    element: (
      <RequireAdmin>
        <AdminLayout />
      </RequireAdmin>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Navigate to="/models" replace /> },
      { path: 'models', element: <ModelsPage /> },
      { path: 'models/new', element: <ModelEditPage /> },
      { path: 'models/:id', element: <ModelEditPage /> },
      { path: 'palettes', element: <PalettesPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      // Component gallery, excluded from production builds.
      ...(import.meta.env.DEV ? [{ path: 'dev/ui-kit', element: <UiKitPage /> }] : []),
    ],
  },
]);
