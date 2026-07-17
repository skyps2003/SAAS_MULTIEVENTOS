# SAAS Eventos (POS System)

Sistema integral de Punto de Venta (POS) y administración para eventos, estructurado como una plataforma SaaS (Software as a Service).

## 🚀 Arquitectura del Proyecto

El proyecto está dividido en dos partes principales: **Backend** y **Frontend** (Monorepo).

### 🖥️ Backend
Ubicado en la carpeta `backend/`. Es una API RESTful desarrollada con:
- **Node.js** y **Express**
- **TypeScript** para tipado estricto
- **PostgreSQL** y **Supabase** para la base de datos
- **Swagger** para la documentación de la API
- Autenticación con **JWT** (JSON Web Tokens) y **bcrypt** para encriptación de contraseñas.

### 🎨 Frontend
Ubicado en la carpeta `frontend/`. Utiliza un entorno Monorepo basado en NPM Workspaces, con aplicaciones construidas en **Next.js**:
- **App Admin (`apps/admin`)**: Panel de control para la administración de eventos, usuarios, inventario y reportes.
- **App Caja (`apps/caja`)**: Interfaz de Punto de Venta (POS) rápida y optimizada para los cajeros durante los eventos.

## ⚙️ Cómo ejecutar el proyecto en modo Desarrollo

### 1. Iniciar el Backend
Abre una terminal, entra a la carpeta `backend` y ejecuta:

```bash
cd backend
npm install
npm run dev
```
La API estará corriendo con `tsx watch` y la documentación (Swagger) estará disponible en la ruta configurada (generalmente `/api-docs`).

### 2. Iniciar el Frontend (Admin o Caja)
Abre otra terminal, entra a la carpeta `frontend` y ejecuta:

```bash
cd frontend
npm install
```
Para iniciar el panel de administración:
```bash
npm run dev:admin
```
Para iniciar la interfaz de caja/POS:
```bash
npm run dev:caja
```
