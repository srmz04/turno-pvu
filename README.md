# TURNO-PVU

Sistema web para organizar turnos, inventario y aplicación de biológicos en puestos de vacunación. La solución combina una PWA que puede seguir operando sin conexión con una API desplegada en Cloudflare Workers.

[Ver aplicación](https://turno-pvu.pages.dev)

## Qué resuelve

- Emisión de fichas con reglas de edad y biológico.
- Operación por centro, turno y rol de usuario.
- Cola local y sincronización al recuperar conectividad.
- Seguimiento de inventario, aplicaciones y cortes operativos.
- Panel público de disponibilidad sin datos personales.
- Registro de auditoría para acciones administrativas.

El flujo operativo utiliza edad, sexo y folios internos. El repositorio público no contiene padrones, expedientes, cuentas, contraseñas ni respaldos de producción.

## Arquitectura

```text
PWA                                  Cloudflare
├── registro/                        ├── Worker REST API
├── aplicar/                         ├── D1
├── coordinador/                     └── KV para rate limiting
├── admin/
└── publico/
```

El frontend usa JavaScript sin framework, IndexedDB para la cola offline y service workers para los módulos instalables. El backend usa Web Crypto para PBKDF2 y JWT, consultas preparadas en D1 y bloqueo temporal tras intentos fallidos.

## Ejecución local

Requiere Node.js 22 o posterior.

```bash
git clone https://github.com/srmz04/turno-pvu.git
cd turno-pvu/backend
npm ci
npx wrangler d1 execute turno-pvu-db --local --file schema.sql
npm run dev
```

En otra terminal se puede servir la raíz con cualquier servidor HTTP estático. La distribución pública no incluye usuarios de prueba; las cuentas deben aprovisionarse fuera del control de versiones.

## Seguridad

- `JWT_SECRET` se administra con Wrangler Secrets.
- Las cuentas se bloquean durante 15 minutos después de cinco intentos fallidos.
- El rate limiting se almacena en KV y falla de forma controlada si el servicio no está disponible.
- Los archivos de datos, semillas operativas, respaldos y credenciales están excluidos del repositorio.

Para reportar una vulnerabilidad, utiliza la sección **Security** del repositorio y evita incluir credenciales o datos reales en una incidencia pública.

## Estado

La aplicación está desplegada y mantiene módulos separados para registro, aplicación, coordinación, administración y consulta pública. El código se publica como referencia técnica; los datos y la configuración operativa permanecen privados.
