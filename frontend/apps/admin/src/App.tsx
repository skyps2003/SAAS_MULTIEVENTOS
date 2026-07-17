import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { useAuthStore } from './stores/authStore';
import { AdminLayout } from './layouts/AdminLayout';
import { PaletasPage } from './pages/PaletasPage';
import { EventosPage } from './pages/EventosPage';
import { AdministradoresPage } from './pages/AdministradoresPage';
import { CategoriasPage } from './pages/CategoriasPage';
import { ProductosPage } from './pages/ProductosPage';
import { CombosPage } from './pages/CombosPage';
import { CajerosPage } from './pages/CajerosPage';
import { MetodosPagoPage } from './pages/MetodosPagoPage';
import { ReportesPage } from './pages/ReportesPage';
import { AlertasPage } from './pages/AlertasPage';
import { SuperAdminEventDashboardPage } from './pages/SuperAdminEventDashboardPage';
import { applyEventPalette, applySuperAdminPalette } from './lib/eventTheme';
import { useThemeStore } from './stores/themeStore';
import { useEventStore } from './stores/eventStore';
import { resolveAssetUrl } from './lib/assetUrl';

// Componente para proteger rutas según el rol
function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode;
  allowedRoles?: string[];
}) {
  const { token, user } = useAuthStore();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    if (user.rol === 'CAJERO') return <Navigate to="/pos" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// POS del Cajero
import { PosPage } from './pages/PosPage';

function PosCajaPlaceholder() {
  // mantengamos el nombre de la función para no romper otras referencias, pero renderiza la página real
  return <PosPage />;
}

function App() {
  const { user } = useAuthStore();
  const userRole = user?.rol;
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const currentEvent = useEventStore((state) => state.currentEvent);
  const fetchCurrentEvent = useEventStore((state) => state.fetchCurrentEvent);

  React.useEffect(() => {
    if (userRole && userRole !== 'SUPER_ADMIN') {
      void fetchCurrentEvent();
    }
  }, [fetchCurrentEvent, userRole]);

  React.useEffect(() => {
    const fallbackIcon = '/favicon.svg';
    const desiredIcon = userRole === 'SUPER_ADMIN'
      ? '/logo-empresa.png'
      : currentEvent?.logo_url
        ? resolveAssetUrl(currentEvent.logo_url)
        : fallbackIcon;
    const pageTitle = userRole === 'SUPER_ADMIN'
      ? 'TUPOS · Superadministración'
      : currentEvent?.nombre
        ? `${currentEvent.nombre} · TUPOS`
        : 'TUPOS · Eventos';

    let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }

    let cancelled = false;
    const applyIcon = (source: string) => {
      if (cancelled || !favicon) return;
      favicon.type = source.includes('.svg') ? 'image/svg+xml' : 'image/png';
      favicon.href = source;
    };

    document.title = pageTitle;
    if (desiredIcon === fallbackIcon) {
      applyIcon(fallbackIcon);
    } else {
      const image = new Image();
      image.onload = () => applyIcon(desiredIcon);
      image.onerror = () => applyIcon(fallbackIcon);
      image.src = desiredIcon;
    }

    return () => {
      cancelled = true;
    };
  }, [currentEvent?.logo_url, currentEvent?.nombre, userRole]);

  React.useEffect(() => {
    try {
      if (user?.rol === 'SUPER_ADMIN') {
        applySuperAdminPalette();
        return;
      }

      const p = localStorage.getItem('paleta');
      if (p) {
        const paleta = JSON.parse(p);
        applyEventPalette(paleta);
      } else {
        applyEventPalette();
      }
    } catch (e) {
      console.error('Error restaurando paleta desde localStorage', e);
    }
  }, [user]);

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors theme={isDarkMode ? 'dark' : 'light'} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route 
          path="/"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN_EVENTO']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Super Admin only */}
          <Route path="administradores" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdministradoresPage /></ProtectedRoute>} />
          <Route path="paletas" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><PaletasPage /></ProtectedRoute>} />
          <Route path="eventos" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><EventosPage /></ProtectedRoute>} />
          <Route path="eventos/:id/dashboard" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperAdminEventDashboardPage /></ProtectedRoute>} />

          {/* Admin Evento modules */}
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="combos" element={<CombosPage />} />
          <Route path="alertas" element={<AlertasPage />} />
          <Route path="cajeros" element={<CajerosPage />} />
          <Route path="metodos-pago" element={<MetodosPagoPage />} />
          <Route path="descuentos" element={<Navigate to="/dashboard" replace />} />
          <Route path="configuracion/mi-evento" element={<Navigate to="/dashboard" replace />} />
          <Route path="reportes" element={<ReportesPage />} />
        </Route>

        {/* Rutas de Caja (POS) - Cajeros y Admin Evento, layout propio sin sidebar admin */}
        <Route 
          path="/pos" 
          element={
            <ProtectedRoute allowedRoles={['CAJERO', 'ADMIN_EVENTO']}>
              <PosCajaPlaceholder />
            </ProtectedRoute>
          } 
        />

        {/* Redirección base */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
