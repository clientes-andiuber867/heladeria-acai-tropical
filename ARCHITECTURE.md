# Arquitectura y mantenimiento

Flujo: componentes de cada feature → services → cliente Supabase → RLS y funciones Postgres.

## Reglas

1. No agregar llamadas a Supabase dentro de componentes reutilizables. Usar services o el contexto específico.
2. Los roles se validan en la base y en la función de administración, nunca solamente en la interfaz.
3. Cambios de tablas deben ser migraciones nuevas. No reescribir migraciones aplicadas.
4. No sumar precios usando valores enviados por el navegador. Mantener `complete_sale` como único punto de creación de ventas.
5. No eliminar ventas: usar anulación con motivo. Mantener instantáneas del nombre y precio de cada artículo.
6. No publicar el token de gestión o la clave service_role. El navegador utiliza exclusivamente la clave pública.
7. Los filtros de fecha usan Bolivia (America/La_Paz). Evitar comparar días UTC con días del negocio.

## Estado remoto

Postgres es la fuente de datos. Realtime actualiza catálogo, perfil y dashboard. El catálogo también refresca al recuperar foco y cada 30 segundos como respaldo. Auditoría e historial se consultan con filtros y paginación. El dashboard agrega todo el rango en servidor (no está limitado a 1000 filas).

## Extensiones futuras

Caja por turnos, gastos/costos, integración bancaria y facturación fiscal requieren módulos separados y reglas específicas. No confundirlos con ingresos y comprobantes internos actuales.
