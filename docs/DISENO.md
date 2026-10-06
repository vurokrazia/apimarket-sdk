# Diseño del SDK `apimarket-sdk`

Este documento define el **contrato público** del SDK antes de implementarlo. Si algo aquí cambia,
la implementación y la documentación deben seguirlo.

## Objetivo

ApiMarket (<https://apimarket.mx>) expone servicios de validación de datos de México (REPUVE, SAT, RENAPO,
IMSS, INFONAVIT, SEP…), pero no ofrece un cliente oficial para Node.js. Este SDK:

- Envuelve los endpoints en métodos tipados y documentados.
- Implementa la autenticación que pide la API (Bearer token).
- Lee la configuración de argumentos **o** de variables de entorno.
- Permite sobreescribir rutas de endpoints (por ejemplo, para migrar a una nueva versión) con límites de seguridad.
- No tiene dependencias de runtime (usa el `fetch` nativo de Node ≥ 18).

La versión inicial cubre **REPUVE (vehículos)**. El núcleo está pensado para agregar más módulos sin cambios.

## Uso esperado

```ts
import { ApiMarketClient } from 'apimarket-sdk';

// Lee APIMARKET_API_KEY del entorno si no se pasa apiKey.
const client = new ApiMarketClient();

const vehiculo = await client.repuve.getVehicle({ placas: 'ABC1234' });
if (vehiculo.found) {
  console.log(vehiculo.data.marca, vehiculo.data.modelo, vehiculo.data.anio);
}

const robo = await client.repuve.getTheftReport({ numero_serie: '4A3AK44T36E024814' });
const propietario = await client.repuve.getOwner({ placas: 'ABC1234' }, { sandbox: true });
```

## Módulo REPUVE

| Método | Endpoint | Créditos | Devuelve |
|---|---|---|---|
| `repuve.getVehicle(params, options?)` | `POST /api/repuve/grupo/datos-vehiculo` | 1 | Datos de registro del vehículo |
| `repuve.getTheftReport(params, options?)` | `POST /api/repuve/grupo/consulta-robo` | 1 | Reporte de robo (si existe) |
| `repuve.getOwner(params, options?)` | `POST /api/repuve/grupo/consulta-propietario` | 1 | Datos del propietario |

**Parámetros** (`VehicleLookupParams`): se requiere **al menos uno**.

| Campo | Tipo | Regla |
|---|---|---|
| `placas` | `string` | 1–10 caracteres alfanuméricos (se permiten guiones y espacios, se eliminan) |
| `numero_serie` | `string` | NIV/VIN de 17 caracteres, sin `I`, `O`, `Q` |

Ambos se normalizan (trim + mayúsculas) antes de enviarse. Si no pasan la validación se lanza
`ApiMarketValidationError` **sin** hacer la petición (no se gastan créditos).

**Transporte.** La colección de Postman envía los parámetros como cuerpo JSON; el OpenAPI los declara en el
query string. El SDK usa **cuerpo JSON por defecto** y permite cambiarlo con `transport: 'query'`.

## Respuesta

Todas las llamadas devuelven `ApiMarketResult<T>`:

```ts
interface ApiMarketResult<T> {
  found: boolean;              // false cuando la API responde "sin datos"
  data: T | null;              // null cuando found === false
  message: string;             // mensaje de la API
  codigoValidacion: string;    // folio único de la petición en ApiMarket
  status: number;              // status HTTP
  rateLimit: { limit: number | null; remaining: number | null };
  raw: unknown;                // cuerpo original, sin modificar
}
```

ApiMarket responde "sin datos" con HTTP 200 y `success: true`, pero con `data` vacío (`[]`) o con un objeto
que solo contiene `ayuda`. El SDK detecta esos casos y devuelve `found: false`.

## Configuración

Precedencia: **opción por llamada → opción del constructor → variable de entorno → valor por defecto.**

| Opción | Variable de entorno | Default | Notas |
|---|---|---|---|
| `apiKey` | `APIMARKET_API_KEY` | — | Obligatoria. |
| `baseUrl` | `APIMARKET_BASE_URL` | `https://apimarket.mx` | Debe ser `https://` (o `http://localhost`). |
| `sandbox` | `APIMARKET_SANDBOX` | `false` | Envía `x-sandbox: true`; no consume créditos. |
| `timeoutMs` | `APIMARKET_TIMEOUT_MS` | `30000` | |
| `maxRetries` | `APIMARKET_MAX_RETRIES` | `0` | Reintenta solo en 429/5xx/red. Cada intento puede costar créditos. |

- La configuración se resuelve **en cada llamada**, leyendo `process.env` en ese momento.
- Si no hay `apiKey` por ninguna vía se lanza `ApiMarketConfigError` indicando que se espera
  `APIMARKET_API_KEY`, **antes** de hacer la petición.
- El token nunca se incluye en mensajes de error ni en `toJSON()` de los errores.

## Overrides de endpoints y versionado

Cada endpoint está en un registro con `{ id, method, path, transport, credits, version }`.

```ts
// Para todo el cliente:
const client = new ApiMarketClient({
  endpoints: {
    'repuve.getVehicle': { path: '/api/v3/repuve/datos-vehiculo', transport: 'query' },
  },
});

// Para una sola llamada:
await client.repuve.getVehicle({ placas: 'ABC1234' }, { path: '/api/v2/repuve/datos-vehiculo' });
```

**Límites** (lanzan `ApiMarketConfigError`):

- `path` debe ser relativo y empezar con `/api/` u `/openapi.json`; no se aceptan URLs absolutas, `..`, `//`
  ni caracteres de control. Así el token no puede enviarse a otro host.
- `baseUrl` debe ser `https://`, salvo `http://localhost` / `http://127.0.0.1` para pruebas.
- `method` solo puede ser `GET`, `POST`, `PUT`, `PATCH` o `DELETE`.
- Solo se pueden sobreescribir ids de endpoints que existen en el registro.

Para endpoints que aún no están envueltos existe `client.request({ method, path, query, body })`, con los mismos límites.

## Errores

Todos heredan de `ApiMarketError` (`status`, `codigoValidacion`, `endpoint`, `body`).

| Clase | Cuándo |
|---|---|
| `ApiMarketConfigError` | Falta `apiKey`, `baseUrl`/`path` inválido, override de endpoint desconocido |
| `ApiMarketValidationError` | Parámetros inválidos (validación local) o HTTP 400/422 |
| `ApiMarketAuthError` | HTTP 401/403 (token inválido o sin permiso) |
| `ApiMarketNotFoundError` | HTTP 404 con cuerpo de error |
| `ApiMarketRateLimitError` | HTTP 429 (incluye `retryAfter` si viene el header) |
| `ApiMarketServerError` | HTTP 5xx |
| `ApiMarketTimeoutError` | Se excedió `timeoutMs` |
| `ApiMarketNetworkError` | Fallo de red / DNS |
| `ApiMarketResponseError` | La respuesta no es JSON válido o trae `success: false` con otro status |

## Fuera de alcance (v0.1)

- Módulos distintos a REPUVE (SAT, RENAPO, IMSS, INFONAVIT, SEP, INE, WhatsApp, IDSE PRO…).
- Procesamiento masivo.
- Navegador (el SDK apunta a Node; no se debe exponer el token en el cliente).
