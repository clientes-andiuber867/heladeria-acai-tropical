# Pedidos públicos por WhatsApp

La carta `/menu` permite seleccionar productos y abrir un mensaje dirigido al
59171661241. El cliente envía el mensaje y adjunta su comprobante manualmente.
No se crean ventas ni se confirma el pago desde la carta pública.

## Antes de publicar

Aplicar `supabase/migrations/202610080001_public_payment_qr.sql`. Esta función
de lectura permite consultar únicamente el QR vigente, su titular y su versión.
No concede acceso público a ventas, personal ni modificación de pagos.

La aplicación compilada usa esa función. Verificar su respuesta con acceso
anónimo antes de desplegar; no publicar la funcionalidad con la migración pendiente.

## Prueba local

Mientras se renueva el token de Management API, Vite puede leer el QR vigente
mediante `/api/local-public-payment` con `VITE_SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY` en `.env.local` (archivo ignorado por Git).
La clave de servicio solo se usa en el servidor local y nunca debe tener el
prefijo `VITE_`. La ruta está disponible exclusivamente en desarrollo y devuelve
solo los tres campos públicos. No existe en la compilación para Vercel.

Ejecutar `node scripts/verify-public-order.mjs` con Vite activo para comprobar
selección, cantidades, QR, descarga, adaptación móvil y el enlace de WhatsApp.
La navegación externa se intercepta durante la prueba: no se envían mensajes
ni se registran pedidos reales.
