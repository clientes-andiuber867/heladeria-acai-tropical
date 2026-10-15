# Consumo de recursos

Revisión del 15 de octubre de 2026. Se conserva la interfaz, las operaciones y la separación por sucursal.

- Pantallas cargadas al visitarlas, conservando su estado al salir. Sus consultas y suscripciones se suspenden mientras no están visibles; se actualizan al volver.
- Catálogo compartido con notificaciones agrupadas; pagos solo se consulta cuando una pantalla visible lo necesita.
- Lecturas REST simultáneas idénticas se comparten por URL, cabeceras (incluida autorización/sucursal) y cuerpo. No hay caché persistente de datos. Escrituras invalidan el grupo pendiente y nunca se comparten. Solicitudes con cancelación propia se mantienen independientes.
- Consultas filtradas explícitamente por sucursal, con columnas limitadas cuando corresponde. RLS sigue siendo la barrera de permisos.
- Migración 202610150004: permisos constantes calculados una vez por sentencia mediante InitPlans e índices para catálogo, exportación, inventario y equipo. Aplicada al Supabase autorizado.
- Logo e iconos PNG: 204551 bytes menos, mismos tamaños y píxeles. Caché de archivos estáticos en Vercel; JavaScript con hash conserva caché immutable. HTML y datos privados no reciben caché pública.
- Excel continúa cargándose bajo demanda y generándose en el navegador. La aplicación Vercel sigue siendo estática, sin funciones de servidor nuevas.

## Medición reproducible

Mismo recorrido con sesión administrativa y compilación de producción local, sin caché previa:

| Medida                                                 |  Antes | Después |
| ------------------------------------------------------ | -----: | ------: |
| Consultas REST al entrar                               |     12 |       6 |
| Consultas al recuperar foco                            |      9 |       3 |
| Consultas al recuperar foco tras visitar historial     |      9 |       3 |
| JavaScript inicial administrador (bytes decodificados) | 648630 |  519932 |
| JavaScript inicial carta (bytes decodificados)         | 515855 |  504884 |

Estos resultados miden ese recorrido; no predicen un porcentaje exacto de ahorro en facturación. Realtime sigue disponible cuando corresponde. No se eliminaron datos ni se comprimieron QR con pérdida.

## Verificación

- npm run build: TypeScript y compilación para Vercel.
- npm run test:branches: 35 comprobaciones SQL de ventas, permisos, informes, inventario y sucursales en PostgreSQL aislado mediante PGlite.
- npm run test:requests: separación de sesiones/sucursales, escrituras, errores y cancelación en el transporte compartido.
- npm test: pruebas públicas; integración antigua requiere credenciales QA adicionales.
- scripts/verify-branches-ui.mjs: aceptación en Supabase autorizado con identidad temporal y limpieza.
- scripts/verify-efficiency-ui.mjs: conservación de formulario y descarga real de Excel comparada con datos de su sucursal; no crea ventas.
- scripts/measure-resources.mjs: medición sobre preview local (5176 por defecto). Estos scripts de entorno autorizado usan la sesión administrativa temporal fuera del repositorio y no forman parte del frontend.

## Corrección de respuestas vacías

Se reprodujo en Chromium un error al reconstruir respuestas HTTP 204: el navegador puede exponer un stream vacío, pero el constructor Response rechaza cualquier cuerpo para ese estado. Afectaba la confirmación de guardados, aunque el servidor hubiera completado la operación.

El transporte ahora conserva la respuesta nativa y solo clona lecturas compartidas. No reconstruye ni almacena en memoria el cuerpo completo de cada respuesta. Se mantiene la separación por sesión/sucursal y la invalidación al escribir.

Regresión añadida:

- `tests/transport.spec.ts`: las 13 llamadas de escritura que devuelven vacío, además de HTTP 204/205/304, JSON, errores y HEAD, mediante respuestas interceptadas en Chromium; sin modificar datos reales.
- `npm run test:workflows`: 42 comprobaciones adicionales en PostgreSQL aislado: nombres con acento, productos, tres formas de pago, anulaciones, caja, reportes, inventario y personal, ejecutadas en ambas sucursales.
- `scripts/verify-branches-ui.mjs`: guarda los valores actuales de sucursal desde escritorio y móvil contra Supabase y exige HTTP 204 y cierre del formulario sin error. No sustituye los nombres ni teléfonos elegidos por el negocio.

Las 35 comprobaciones previas de aislamiento siguen vigentes. Las tres pruebas antiguas de integración de `npm test` requieren su propia configuración QA y se omiten si no está disponible; las verificaciones de interfaz actuales se ejecutan mediante los scripts indicados.
