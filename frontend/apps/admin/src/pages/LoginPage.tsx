import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { useEventStore } from '../stores/eventStore';
import { toast } from 'sonner';
import api from '../services/api';
import { applyEventPalette } from '../lib/eventTheme';

const loginSchema = z.object({
  identificador: z.string().min(1, 'El usuario es requerido'),
  credencial: z.string().min(4, 'La contraseña o PIN es requerido'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('tupos_saved_email');
    if (savedEmail) {
      setValue('identificador', savedEmail);
      setRememberMe(true);
    }
  }, [setValue]);

  const applyPalette = (paleta: Record<string, any> | null) => {
    if (!paleta) return;
    try {
      localStorage.setItem('paleta', JSON.stringify(paleta));
      applyEventPalette(paleta);
    } catch (e) {
      console.error('Error aplicando paleta:', e);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      const isEmail = data.identificador.includes('@');

      if (rememberMe) {
        localStorage.setItem('tupos_saved_email', data.identificador);
      } else {
        localStorage.removeItem('tupos_saved_email');
      }

      if (isEmail) {
        const res = await authService.login(data.identificador, data.credencial);
        localStorage.setItem('token', res.token);
        setAuth(res.token, res.usuario);

        // Aplicar paleta si viene en la respuesta
        if (res.paleta) {
          applyPalette(res.paleta);
        }

        toast.success('Bienvenido al panel de administración');
        navigate('/dashboard');
      } else {
        const res = await api.post('/auth/login-cajero', {
          codigo_evento: data.identificador,
          pin: data.credencial,
        });
        const result = res.data;
        
        localStorage.setItem('token', result.token);
        // Guardar código de caja para que POS pueda cargar en modo solo lectura si no hay token
        try {
          localStorage.setItem('codigo_caja', data.identificador);
        } catch (e) {
          console.warn('No se pudo guardar codigo_caja en localStorage', e);
        }
        
        const cajeroUser = {
          id_usuario: result.sesion.id_sesion,
          nombre: result.sesion.cajero,
          email: `${data.identificador}@terminal.tupos.com`,
          rol: 'CAJERO',
          id_evento: result.evento.id_evento,
        };
        
        setAuth(result.token, cajeroUser);
        
        // Guardar el evento en el store global para que POSPage pueda ver el logo y nombre
        if (result.evento) {
          useEventStore.getState().setCurrentEvent(result.evento);
        }

        // Aplicar paleta si viene en la respuesta del cajero (evento.paleta o paleta)
        if (result.paleta) applyPalette(result.paleta);
        else if (result.evento?.paleta) applyPalette(result.evento.paleta);

        toast.success(`Terminal activada: ${result.evento.nombre}`);
        navigate('/pos');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-8 font-sans">
      
      {/* Contenedor principal estilo Tarjeta Flotante Moderna */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] flex flex-col md:flex-row overflow-hidden relative min-h-[650px] border border-slate-100">
        
        {/* === LADO IZQUIERDO (Gradiente 3D Moderno) === */}
        <div className="md:w-5/12 relative bg-[#020617] overflow-hidden md:h-auto h-64 flex-shrink-0 z-10 flex flex-col justify-between"
             style={{ 
               clipPath: window.innerWidth > 768 ? 'polygon(0 0, 100% 0, 85% 100%, 0% 100%)' : 'none' 
             }}>
          
          {/* --- Efectos de Gradiente 3D (Mesh Gradient) --- */}
          {/* Orbe Azul Superior */}
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-blue-600 to-cyan-400 blur-[80px] opacity-40 mix-blend-screen"></div>
          {/* Orbe Púrpura Inferior */}
          <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] rounded-full bg-gradient-to-tl from-indigo-700 via-purple-600 to-transparent blur-[100px] opacity-30 mix-blend-screen"></div>
          {/* Orbe Central Cian */}
          <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-gradient-to-r from-teal-400/40 to-blue-500/40 blur-[60px] opacity-30 mix-blend-screen"></div>
          
          {/* Grid pattern sutil para dar profundidad espacial */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]"></div>

          {/* Elementos 3D Glassmorphism Flotantes */}
          <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl transform rotate-12 shadow-2xl"></div>
          <div className="absolute bottom-1/3 left-1/4 w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-full transform -rotate-12 shadow-xl"></div>
          
          {/* Contenido sobre el fondo */}
          <div className="relative z-10 flex-1 flex flex-col justify-end p-12 w-full md:w-[110%] pb-16">
            <div className="flex items-center space-x-2 mb-6">
              <Shield className="w-8 h-8 text-accent" />
              <span className="text-xl font-bold text-white tracking-widest">TUPOS</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight text-white">
              Gestión <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">Inteligente</span>
            </h1>
            <p className="text-base text-slate-300 max-w-[80%] leading-relaxed font-medium">
              El ecosistema definitivo para administrar tus eventos corporativos y terminales de venta.
            </p>
          </div>
        </div>

        {/* === LADO DERECHO (Formulario Moderno) === */}
        <div className="md:w-7/12 w-full bg-white flex flex-col justify-center p-8 md:p-16 z-10 relative">
          
          <div className="w-full max-w-md mx-auto md:mx-0 md:ml-auto">
            {/* Encabezado del Formulario */}
            <div className="mb-10">
              <p className="text-primary text-xs font-bold tracking-widest uppercase mb-2 flex items-center">
                <span className="w-4 h-0.5 bg-primary mr-2"></span>
                Acceso Seguro
              </p>
              <h2 className="text-slate-900 text-4xl font-extrabold tracking-tight">
                Bienvenido
              </h2>
              <p className="text-slate-500 mt-2 text-sm">
                Ingresa a tu cuenta corporativa para continuar.
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Campo Usuario Moderno */}
              <div className="space-y-2">
                <label className="text-slate-700 text-sm font-semibold">
                  Usuario o Código
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    placeholder="admin@tupos.com"
                    className={`block w-full pl-11 pr-4 py-3.5 bg-slate-50 border ${errors.identificador ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-primary focus:ring-primary'} rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all`}
                    {...register('identificador')}
                  />
                </div>
                {errors.identificador && <p className="text-xs text-red-500 mt-1 font-medium">{errors.identificador.message}</p>}
              </div>
              
              {/* Campo Contraseña Moderno */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-slate-700 text-sm font-semibold">
                    Contraseña o PIN
                  </label>
                  <a href="#" className="text-sm font-semibold text-primary hover:text-primary/90 transition-colors">
                    ¿Olvidaste tu clave?
                  </a>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`block w-full pl-11 pr-12 py-3.5 bg-slate-50 border ${errors.credencial ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 focus:border-primary focus:ring-primary'} rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white tracking-widest text-lg transition-all`}
                    {...register('credencial')}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.credencial && <p className="text-xs text-red-500 mt-1 font-medium">{errors.credencial.message}</p>}
              </div>

              {/* Checkbox Recordarme */}
              <div className="flex items-center pt-2">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:bg-primary checked:border-primary transition-all cursor-pointer"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="ml-3 text-sm text-slate-600 font-medium group-hover:text-slate-900 transition-colors">Recordar mi sesión</span>
                </label>
              </div>

              {/* Botón de Envío con Gradiente */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-4 px-4 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 focus:outline-none focus:ring-4 focus:ring-primary/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed group mt-4 relative overflow-hidden"
              >
                {/* Brillo decorativo al hacer hover */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Ingresar al Sistema</span>
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Formulario */}
            <div className="mt-12 flex justify-between items-center text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-widest">
                TUPOS ENTERPRISE © 2026
              </span>
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <div className="w-2 h-2 rounded-full bg-accent"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
