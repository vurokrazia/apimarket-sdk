# apimarket-sdk

SDK **no oficial** de Node.js / TypeScript para [ApiMarket](https://apimarket.mx), la API de validación de datos
de México. Envuelve los endpoints en métodos tipados, maneja la autenticación, los errores y la configuración
por variables de entorno.

> Versión actual: **0.1.0** — módulo **REPUVE (vehículos)**. Próximos módulos: SAT, RENAPO, IMSS, INFONAVIT, SEP.

- ✅ TypeScript con tipos completos (ESM y CommonJS)
- ✅ Cero dependencias (usa el `fetch` nativo de Node 18+)
- ✅ Configuración por argumentos **o** variables de entorno
- ✅ Validación local de placas y NIV (no gastas créditos en datos mal formados)
- ✅ Respuestas normalizadas (`found: true/false`) y errores tipados
- ✅ Sandbox, timeouts, reintentos opcionales y overrides de rutas con límites de seguridad

## Instalación

```bash
npm install apimarket-sdk
```

O directo desde GitHub (se compila al instalar):

```bash
npm install github:vurokrazia/apimarket-sdk
```

Requiere Node.js 18 o superior.

## Inicio rápido

1. Define tu token (se obtiene al crear una cuenta en <https://apimarket.mx>):

   ```bash
   export APIMARKET_API_KEY="tu-token"
   ```

2. Consulta un vehículo:

   ```ts
   import { ApiMarketClient } from 'apimarket-sdk';

   const client = new ApiMarketClient(); // lee APIMARKET_API_KEY

   const vehiculo = await client.repuve.getVehicle({ placas: 'ABC1234' });

   if (vehiculo.found) {
     console.log(vehiculo.data.marca, vehiculo.data.modelo, vehiculo.data.anio);
   } else {
     console.log('No inscrito en REPUVE:', vehiculo.message);
   }
   ```

   Con CommonJS:

   ```js
   const { ApiMarketClient } = require('apimarket-sdk');
   ```

## Módulo REPUVE

| Método | Qué consulta | Endpoint | Créditos |
|---|---|---|---|
| `client.repuve.getVehicle(params, options?)` | Marca, modelo, año, color, NIV, motor, uso, estatus en el padrón | `POST /api/repuve/grupo/datos-vehiculo` | 1 |
| `client.repuve.getTheftReport(params, options?)` | Si tiene reporte de robo, la fuente y el NUC | `POST /api/repuve/grupo/consulta-robo` | 1 |
| `client.repuve.getOwner(params, options?)` | Nombre, RFC y domicilio del propietario | `POST /api/repuve/grupo/consulta-propietario` | 1 |

`params` acepta `placas` y/o `numero_serie` (NIV de 17 caracteres); se requiere al menos uno.

```ts
const robo = await client.repuve.getTheftReport({ numero_serie: '4A3AK44T36E024814' });
if (robo.found && robo.data.robado) {
  console.warn('Reporte de robo:', robo.data.fuente, robo.data.nuc);
}
```

Guía completa, campos de cada respuesta y ejemplos: **[docs/repuve.md](docs/repuve.md)**.

## Configuración

Cada opción se puede pasar **por llamada**, **en el constructor** o por **variable de entorno**, en ese orden de prioridad.

| Opción | Variable de entorno | Default |
|---|---|---|
| `apiKey` | `APIMARKET_API_KEY` | — (obligatoria) |
| `baseUrl` | `APIMARKET_BASE_URL` | `https://apimarket.mx` |
| `sandbox` | `APIMARKET_SANDBOX` | `false` |
| `timeoutMs` | `APIMARKET_TIMEOUT_MS` | `30000` |
| `maxRetries` | `APIMARKET_MAX_RETRIES` | `0` |

```ts
// Todo desde el entorno
const client = new ApiMarketClient();

// O explícito
const client = new ApiMarketClient({ apiKey: 'tu-token', sandbox: true, timeoutMs: 10_000 });

// O solo para una llamada
await client.repuve.getVehicle({ placas: 'ABC1234' }, { apiKey: 'otro-token', sandbox: true });
```

Si no hay token por ninguna vía, el SDK lanza `ApiMarketConfigError` **antes** de hacer la petición, indicando que
espera `APIMARKET_API_KEY`. Más detalles (overrides de rutas, versionado, límites): **[docs/configuracion.md](docs/configuracion.md)**.

## Respuesta

Todos los métodos devuelven `ApiMarketResult<T>`:

| Campo | Tipo | Descripción |
|---|---|---|
| `found` | `boolean` | `false` cuando ApiMarket responde "sin datos" |
| `data` | `T \| null` | Datos de la consulta; `null` si `found` es `false` |
| `message` | `string` | Mensaje de la API |
| `codigoValidacion` | `string \| null` | Folio único de la petición en ApiMarket |
| `status` | `number` | Status HTTP |
| `rateLimit` | `{ limit, remaining }` | Headers `X-RateLimit-*` |
| `raw` | `unknown` | Cuerpo original sin modificar |

## Errores

Todos los errores heredan de `ApiMarketError` e incluyen `status`, `codigoValidacion`, `endpoint` y `body`.

| Error | Cuándo |
|---|---|
| `ApiMarketConfigError` | Falta el token, `baseUrl` o ruta inválida |
| `ApiMarketValidationError` | Parámetros inválidos (local) o HTTP 400/422 |
| `ApiMarketAuthError` | HTTP 401/403 |
| `ApiMarketNotFoundError` | HTTP 404 con error |
| `ApiMarketRateLimitError` | HTTP 429 (`retryAfter`) |
| `ApiMarketServerError` | HTTP 5xx |
| `ApiMarketTimeoutError` | Se excedió `timeoutMs` |
| `ApiMarketNetworkError` | Fallo de red |
| `ApiMarketResponseError` | Respuesta inesperada o no JSON |

```ts
import { ApiMarketError, ApiMarketAuthError } from 'apimarket-sdk';

try {
  await client.repuve.getOwner({ placas: 'ABC1234' });
} catch (error) {
  if (error instanceof ApiMarketAuthError) {
    // token inválido o sin permiso para este endpoint
  } else if (error instanceof ApiMarketError) {
    console.error(error.name, error.message, error.codigoValidacion);
  }
}
```

## Endpoints que aún no están envueltos

`client.request()` usa la misma autenticación, timeouts y manejo de errores:

```ts
const saldo = await client.request({ method: 'GET', path: '/api/balance' });
```

## Seguridad

- El token **nunca** aparece en mensajes de error ni en `error.toJSON()`.
- Las rutas deben empezar con `/api/` y la `baseUrl` debe ser `https://`: el token no puede enviarse a otro host.
- Úsalo solo en el servidor. No expongas tu token en el navegador.
- `getOwner` devuelve datos personales: trátalos conforme a la LFPDPPP y a tu aviso de privacidad.

## Desarrollo

```bash
npm install
npm test            # pruebas unitarias (fetch simulado)
npm run typecheck
npm run build       # genera dist/ (ESM + CJS + .d.ts)
APIMARKET_API_KEY=... npm run test:integration   # sandbox real, no consume créditos
APIMARKET_API_KEY=... APIMARKET_SANDBOX=true npm run example -- ABC1234
```

Arquitectura y decisiones de diseño: [docs/DISENO.md](docs/DISENO.md).

## Aviso

Proyecto independiente, sin relación oficial con ApiMarket. Los datos provienen de ApiMarket y de sus fuentes;
su disponibilidad depende de ellos.

## Licencia

[MIT](LICENSE)
