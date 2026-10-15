# Dos sucursales

El selector está debajo del logo del panel. El lápiz edita el nombre y el
WhatsApp de pedidos de la sucursal seleccionada. Los identificadores y enlaces
no cambian al renombrarla. El administrador puede alternar entre ambas;
el cajero utiliza únicamente la sucursal asignada en su perfil.

Los registros anteriores se asignan a **Açaí Tropical 1**. **Açaí Tropical 2**
comienza vacía, con un grupo de inventario «General». No se copian productos,
ventas ni QR de pago. Inicialmente las dos sucursales usan el WhatsApp existente;
el administrador puede cambiar cada número desde el lápiz del selector.

Ventas, detalles, caja, catálogo y secciones, inventario y movimientos,
configuración de pagos y auditoría tienen `branch_id`. Los informes y archivos
Excel usan la sucursal activa; los comprobantes y archivos Excel muestran su
nombre. Los números de pedido siguen siendo únicos en todo el negocio y no se
reinician. Los usuarios visibles son los cajeros de la sucursal y los
administradores, que tienen acceso a ambas. Al crear o editar un cajero se elige
su sucursal; debe cerrar su caja antes de reasignarlo. Su historial no se mueve.

Cada carta se abre en `/menu?sucursal=<uuid>`. El pedido de WhatsApp identifica
la sucursal y usa su número de contacto y su QR de pago. Los pedidos del
navegador y los cobros pendientes se guardan con una clave distinta por sucursal.
El antiguo enlace `/menu` continúa abriendo la primera sucursal.

## Base de datos y permisos

Aplicar en orden las migraciones `202610150001_branches.sql`,
`202610150002_branch_runtime_permissions.sql` y
`202610150003_branch_role_inheritance.sql`, y desplegar `team-admin` junto con
el frontend. Se conserva la firma anterior de edición de usuarios para que
la versión publicada anterior continúe funcionando con la primera sucursal.

`x-branch-id` selecciona el contexto por solicitud. `selected_branch()` comprueba
la asignación y estado del usuario en la base de datos; un cajero que falsifique
el encabezado no obtiene acceso. No se guardan elecciones globales en el perfil
del administrador: distintas pestañas pueden operar en sucursales distintas.

Las funciones de negocio mantienen sus validaciones originales y ahora son
propiedad de `acai_branch_executor`, un rol NOLOGIN/NOBYPASSRLS que no es dueño
de las tablas. Sus consultas, agregaciones, escrituras y disparadores quedan
limitados por RLS. La pertenencia heredable a `authenticated` proporciona el
permiso de uso del esquema `auth` que controla Supabase; no permite a un usuario
asumir el rol executor. Las funciones de identidad y gestión de usuarios
mantienen su propietario y comprueban expresamente los permisos.

Toda futura función de negocio SECURITY DEFINER que lea o escriba datos de
sucursales debe usar este rol y fijar `search_path`, o comprobar la sucursal
explícitamente. Las funciones administrativas de usuarios/sucursales son
globales y solo accesibles a administradores.

Realtime comprueba permisos sin encabezados HTTP: permite eventos de las
sucursales autorizadas y las suscripciones filtran por `branch_id`. Las
solicitudes REST llevan el encabezado; la API antigua sin ese encabezado usa
la primera sucursal (o la asignada al cajero). Los recursos de imagen de los
catálogos y QR siguen siendo públicos, igual que antes.

## Verificación

- `npm run test:branches`: PostgreSQL local mediante PGlite, sin conexión ni
  escrituras al negocio. Prueba ventas e idempotencia, mezcla de productos,
  permisos, informes, auditoría, catálogo, caja, reasignación e inventario/QR.
- `npm run build`: comprobación de tipos y compilación.
- `scripts/verify-branches-ui.mjs`: aceptación sobre un Supabase autorizado.
  Requiere la sesión administrativa temporal usada por los scripts existentes;
  no guarda claves en el repositorio. Crea y elimina una identidad QA con sufijo
  aleatorio, comprueba el acceso real y captura escritorio/móvil.

La actualización del 15 de octubre de 2026 se aplicó al Supabase autorizado;
el frontend se verificó en local antes de preparar su publicación mediante GitHub/Vercel.
