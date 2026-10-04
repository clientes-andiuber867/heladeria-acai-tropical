# Açaí Tropical — sistema de ventas

Aplicación React + TypeScript + Vite conectada a Supabase (Auth, Postgres, Storage y Edge Functions). Frontend desplegable en Vercel.

## Iniciar

```sh
npm ci
npm run dev
npm run build
npm test
```

Copiar `.env.example` a `.env.local` y completar la URL y clave pública de Supabase. El proyecto de esta computadora ya tiene `.env.local` configurado. Nunca incluir claves administrativas en variables `VITE_*`.

## Módulos

- `src/features/auth`: inicio de sesión, recuperación y cambio de contraseña.
- `src/features/catalog`: catálogo, creación/edición, imagen y disponibilidad, archivo de productos.
- `src/features/sales`: punto de venta, pedido recuperable, historial, comprobante y anulación con motivo.
- `src/features/dashboard`: agregaciones por fechas calculadas en Postgres.
- `src/features/audit`: búsqueda y paginación del registro de movimientos.
- `src/features/team`: altas de usuarios, roles y activación/desactivación.
- `src/features/menu`: carta pública y QR permanente por URL.
- `src/services`: todas las llamadas a Supabase por dominio.
- `src/context`: sesión/perfil, catálogo compartido y notificaciones.
- `src/components`: navegación, marca, diálogos y estados comunes.
- `src/lib`, `src/types`: cliente, formatos y contratos.
- `supabase/migrations`: evolución versionada de tablas, políticas y funciones.
- `supabase/functions/team-admin`: función de administración de cuentas. Valida JWT y rol activo en servidor. Su `verify_jwt` de plataforma está desactivado porque verifica el usuario explícitamente con Auth.

`npm run format` aplica un formato consistente para mantenimiento. Las pantallas internas cargan por separado.

## Operación y permisos

Registro público desactivado. Cuentas creadas por un administrador, con contraseña temporal y cambio solicitado al primer ingreso. Roles en `profiles`, sin permisos de modificación directa desde el cliente. Desactivar un usuario bloquea operaciones aunque tenga una sesión emitida anteriormente.

Clientes anónimos solo leen el catálogo y las imágenes públicas. Cajeros registran ventas y consultan sus propios comprobantes. Administradores gestionan catálogo, equipo, estadísticas y auditoría. Imágenes hasta 5 MB (JPG/PNG/WebP).

`complete_sale` calcula precios, cantidades y total dentro de una transacción. Rechaza precios desactualizados, productos agotados y efectivo insuficiente. Usa un identificador idempotente y bloqueo para impedir duplicados en reintentos. El pedido pendiente se conserva en sessionStorage solo para recuperar una operación con resultado incierto; los registros reales están en Postgres. No borrar ese pedido manualmente mientras se verifica.

Anulaciones conservan la venta y su motivo. Auditoría de productos y ventas escrita en servidor, sin permisos de borrado o edición para usuarios de la aplicación. Los inicios de sesión también se registran (los logs de Auth de Supabase complementan esta información). El dueño del proyecto Supabase conserva capacidad administrativa sobre la base de datos.

## Primer administrador

Durante la configuración local se proporciona una pantalla privada de una sola vez, servida por `scripts/bootstrap-admin.mjs` en 127.0.0.1. El enlace aleatorio se guarda temporalmente fuera del repositorio. Esta pantalla solo puede crear el administrador si no existe otro activo y se cierra al completar. No forma parte de la web publicada.

Alternativa: crear el usuario desde Supabase Auth y asignar explícitamente su perfil mediante SQL administrativo. El trigger crea perfiles **inactivos y con rol cajero**, nunca administradores desde metadatos del cliente. La función de equipo activa y asigna el perfil después de verificar al administrador que la llama.

## Vercel

Importar el repositorio, preset Vite, build `npm run build`, salida `dist`. Configurar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_SITE_URL` (opcional, URL pública definitiva, por ejemplo `https://tu-dominio.com`)

En Supabase Auth configurar Site URL y Redirect URLs con la URL definitiva, incluyendo `/password`. Se mantuvo localhost para desarrollo. Regenerar el QR desde el dominio público antes de imprimir: un QR de localhost solo funciona en esta computadora.

## Alcance de cobros

Efectivo calcula cambio; QR registra un pago **verificado manualmente en la cuenta bancaria**. No existe integración bancaria ni verificación automática de transferencias. El comprobante interno no es factura fiscal. Dashboard muestra ingresos cobrados, no utilidad neta (costos/gastos aún no solicitados como módulo). No se cargaron precios o productos inventados; la carta comienza con datos reales que agregue el administrador.

La recuperación por correo requiere configurar SMTP para envío fiable a usuarios externos. La instalación conserva el servicio predeterminado de Supabase, con sus restricciones. No se envían invitaciones automáticas: las cuentas nuevas se crean desde Mi equipo.

## Verificación

Pruebas públicas con Playwright. Las pruebas de integración requieren cuentas QA temporales y un archivo de credenciales en la carpeta temporal del sistema; no están dentro del repositorio. El script `scripts/verify-live.mjs` comprueba RLS, transacciones, idempotencia, archivos y permisos de usuarios. Ejecutar scripts administrativos solo en un entorno autorizado y con credenciales de corta duración; no son parte del frontend ni se ejecutan en Vercel.

El logo `public/logo.png` proviene del archivo proporcionado por el negocio. Tipografías Outfit y DM Sans.

## Pedidos, imágenes y consumo

Los pedidos usan una secuencia de PostgreSQL y se muestran como AT-000001. Los pedidos existentes conservan su UUID y reciben un número según su fecha; los siguientes números se asignan en el servidor. La secuencia no se reinicia ni reutiliza números y puede tener saltos por transacciones canceladas.

Las fotos nuevas del catálogo admiten originales JPG/PNG/WebP de hasta 10 MB. El navegador elimina metadatos al recodificar, mantiene proporciones y reduce a un máximo de 1280 píxeles y 300 KB antes de subir. El bucket limita archivos a 1 MB. Las imágenes anteriores se conservan; los QR bancarios no pasan por compresión con pérdida. Los archivos tienen nombres únicos y caché de un año.

Los apartados permitidos se preparan una vez en segundo plano tras entrar y permanecen montados para cambiar de pantalla sin descartar datos ni formularios. Catálogo y pagos reciben cambios mediante Realtime y al recuperar el foco; ya no consultan cada 30 segundos. La configuración de pagos comparte un proveedor. Caja escucha cambios de sus ventas y aperturas/cierres. Los temporizadores de cambio de día son locales y no hacen consultas periódicas.

El botón Imprimir crea un documento independiente con el comprobante, fecha/hora original de emisión en Bolivia y detalle de precios. La impresión A4 excluye navegación y contenido de fondo. Una venta extensa puede necesitar varias páginas; no se fuerza una hoja adicional. Sigue siendo comprobante interno, no factura fiscal.

La cajera consulta solamente ventas propias del día de Bolivia, protegido también por RLS. La apertura y cierre de caja guardan fondo, efectivo esperado, contado y diferencia. La sesión no se persiste: recargar o abrir de nuevo requiere iniciar sesión; esto no cierra una caja abierta.

Auditoría incluye la pestaña «Aperturas y cierres de caja», con filtro de servidor por esos dos eventos, período, búsqueda y paginación.

## Exportación del historial

El administrador puede exportar a Excel desde Historial de ventas. Respeta el período, forma de pago y estado seleccionados, independientemente de la página visible. Consulta por lotes de 500 pedidos ordenados por número; excluye nuevas ventas posteriores al inicio de la consulta. Los cambios de estado durante la exportación pueden reflejarse según el momento de lectura de cada lote.

La plantilla incluye logo y hojas Resumen, Ventas y Detalle de productos, con fechas/horas de Bolivia, moneda, filtros y encabezados inmovilizados. Las ventas anuladas se conservan en el detalle pero no cuentan como ingresos. Los totales del pedido no se repiten por producto. La librería de Excel se carga únicamente al solicitar la descarga y el archivo se genera en el navegador, sin guardarlo en Storage ni usar funciones de Vercel.

## Aplicación instalable

El manifiesto web configura Açaí Tropical en modo standalone con iconos del negocio de 192/512 px, máscara segura y Apple Touch de 180 px. El botón Instalar aplicación usa el diálogo del navegador cuando está disponible y muestra instrucciones en otros casos. En producción se instala desde el dominio HTTPS de Vercel; una instalación de localhost depende del servidor local. No se almacenan ventas offline ni se cambia la persistencia de sesión.
