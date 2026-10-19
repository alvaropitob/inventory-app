# Inventario de laboratorio clínico

Aplicación principal del repositorio: Next.js 15, React y Supabase.

## Configuración local

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica
```

Configura estas variables en `.env.local` (ignorado por Git). Nunca expongas una clave `service_role` al navegador.

```powershell
npm ci
npm run dev
```

## Base de datos

Las migraciones versionadas viven en `supabase/migrations`. Revisa el proyecto vinculado antes de ejecutar `npx supabase db push`. Los roles de aplicación se resuelven desde `public.users` y `public.roles`; RLS sigue siendo la barrera de acceso a datos.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: build de producción.
- `npm test`: pruebas unitarias existentes.
- `npm run lint`: ESLint.

`../client` es una segunda implementación Vite independiente y no es el frontend desplegado por esta aplicación.
