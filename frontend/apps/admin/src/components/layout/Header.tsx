import { Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export function Header() {
  const { pathname } = useLocation();
  
  // Pequeño helper para el Breadcrumb
  const getBreadcrumb = () => {
    if (pathname.includes('/dashboard')) return 'Dashboard';
    if (pathname.includes('/paletas')) return 'Gestión de Paletas';
    if (pathname.includes('/eventos')) return 'Gestión de Eventos';
    return 'Administración';
  };

  return (
    <header className="h-16 bg-white dark:bg-[#020617] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-10 transition-colors">
      <div className="flex items-center text-sm font-semibold text-slate-500 dark:text-slate-400">
        {getBreadcrumb()}
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
