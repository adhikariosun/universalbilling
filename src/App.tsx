import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SettingsProvider } from '@/lib/settings';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CreateBillPage } from '@/pages/CreateBillPage';
import { BillsPage } from '@/pages/BillsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FullPageSpinner } from '@/components/ui/Spinner';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner message="Loading..." />;

  if (!user) return <Navigate to="/login" replace />;

  return (
    <SettingsProvider>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/bills/create" element={<CreateBillPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SettingsProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner message="Loading..." />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
