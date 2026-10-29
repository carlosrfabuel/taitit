import { Navigate, createBrowserRouter } from 'react-router';
import { AdminLayout } from './components/AdminLayout';
import { RequireAdmin } from './auth/RequireAdmin';
import { LoginPage } from './pages/LoginPage';
import { ConfirmedPage } from './pages/ConfirmedPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AccountDeletionPage } from './pages/AccountDeletionPage';
import { HomePage } from './pages/HomePage';
import { ModelsPage } from './pages/ModelsPage';
import { ModelEditPage } from './pages/ModelEditPage';
import { SettingsPage } from './pages/SettingsPage';
import { PalettesPage } from './pages/PalettesPage';
import { OrdersPage } from './pages/OrdersPage';
import { SparePartsPage } from './pages/SparePartsPage';
import { CustomersPage } from './pages/CustomersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { UiKitPage } from './pages/UiKitPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Public: where the app's sign-up confirmation email lands (no admin login).
  { path: '/confirmed', element: <ConfirmedPage /> },
  // Public: the Supabase Site URL (fallback for any email link Supabase won't redirect elsewhere).
  { path: '/link', element: <ConfirmedPage kind="other" /> },
  // Public: the privacy policy (app sign-up and account screens, app stores).
  { path: '/privacy', element: <PrivacyPage /> },
  // Public: how to delete an account, with or without the app (Google Play).
  { path: '/account-deletion', element: <AccountDeletionPage /> },
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
      { index: true, element: <HomePage /> },
      { path: 'models', element: <ModelsPage /> },
      // New models are added with the zone tool (2026-10-23): an old link lands on the list.
      { path: 'models/new', element: <Navigate to="/models" replace /> },
      { path: 'models/:id', element: <ModelEditPage /> },
      { path: 'palettes', element: <PalettesPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'spare-parts', element: <SparePartsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      // Component gallery, excluded from production builds.
      ...(import.meta.env.DEV ? [{ path: 'dev/ui-kit', element: <UiKitPage /> }] : []),
    ],
  },
]);
