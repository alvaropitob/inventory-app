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

## Base de datos y control de acceso

Las migraciones versionadas viven en `supabase/migrations`. Revisa el proyecto vinculado y el destino antes de ejecutar `npx supabase db push`.

El control de acceso usa `public.users` / `public.user_roles` para la identidad y asignaciones, `public.roles` para perfiles, `public.access_permissions` como catálogo y `public.access_role_permissions` para la matriz. Aplica en orden las migraciones `20261106130000_dynamic_access_control.sql`, `20261106140000_dynamic_rpc_permissions.sql` y `20261106150000_dynamic_rls_permissions.sql`. La primera conserva la matriz actual de admin, supervisor, operator y auditor, añade auditoría de cambios y funciones de administración; la segunda cambia las operaciones privilegiadas de inventario a verificaciones por permiso; la tercera reemplaza las políticas RLS antiguas por permisos dinámicos.

La aplicación presenta la gestión en `/dashboard/usuarios` y `/dashboard/roles`. Los cambios de acceso requieren motivo y pasan por funciones transaccionales de PostgreSQL; el cliente no escribe directamente la matriz. Las solicitudes nuevas quedan inactivas hasta que un administrador les asigne roles y active la cuenta. RLS y las verificaciones de servidor siguen siendo obligatorias.

## Comandos

- `npm run dev`: servidor de desarrollo.
- `npm run build`: build de producción.
- `npm test`: pruebas unitarias existentes.
- `npm run lint`: ESLint.

`../client` es una segunda implementación Vite independiente y no es el frontend desplegado por esta aplicación.
