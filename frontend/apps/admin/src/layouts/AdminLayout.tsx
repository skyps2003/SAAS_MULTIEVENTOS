import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { useAuthStore } from '../stores/authStore';

export function AdminLayout() {
  const isEventAdmin = useAuthStore((state) => state.user?.rol === 'ADMIN_EVENTO');

  return (
    <div className={`${isEventAdmin ? 'event-palette-scope' : ''} min-h-dvh bg-slate-50 dark:bg-slate-950 flex transition-colors relative overflow-hidden`}>

      {/* Sidebar fijo a la izquierda */}
      <Sidebar />
      
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col h-dvh overflow-hidden relative">


        {/* Contenido de la página */}
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-y-auto px-4 pb-6 pt-20 sm:px-6 lg:p-8 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
