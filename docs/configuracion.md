# Configuración

## Precedencia

Cada valor se resuelve **en cada llamada** en este orden:

1. Opción pasada a la llamada: `client.repuve.getVehicle(params, { apiKey })`
2. Opción del constructor: `new ApiMarketClient({ apiKey })`
3. Variable de entorno: `APIMARKET_API_KEY`
4. Valor por defecto

Como las variables de entorno se leen al momento de la llamada, puedes crear el cliente al iniciar la aplicación
aunque el token se cargue después (por ejemplo, desde un gestor de secretos).

## Variables de entorno

| Variable | Opción | Default | Formato |
|---|---|---|---|
| `APIMARKET_API_KEY` | `apiKey` | — | Texto. **Obligatoria** si no se pasa `apiKey`. |
| `APIMARKET_BASE_URL` | `baseUrl` | `https://apimarket.mx` | URL `https://` (o `http://localhost`) |
| `APIMARKET_SANDBOX` | `sandbox` | `false` | `true` / `false` / `1` / `0` |
| `APIMARKET_TIMEOUT_MS` | `timeoutMs` | `30000` | Entero positivo |
| `APIMARKET_MAX_RETRIES` | `maxRetries` | `0` | Entero de 0 a 5 |

Hay un archivo de ejemplo en [`.env.example`](../.env.example). El SDK **no** carga `.env` por sí mismo; usa
`node --env-file=.env` (Node 20.6+) o la librería que prefieras.

Los nombres están exportados como constante:

```ts
import { ENV_VARS } from 'apimarket-sdk';
ENV_VARS.apiKey; // 'APIMARKET_API_KEY'
```

### Token faltante

Si no hay token por ninguna vía:

```
ApiMarketConfigError: No se encontró el token de ApiMarket. Pásalo como opción "apiKey" o define la variable de entorno APIMARKET_API_KEY.
```

El error se lanza **antes** de hacer la petición.

## Sandbox

Con `sandbox: true` el SDK envía el header `x-sandbox: true`. ApiMarket responde con datos de prueba y **no
consume créditos**. Úsalo durante el desarrollo y en CI.

## Reintentos

Por defecto **no** se reintenta, porque cada llamada puede consumir créditos. Con `maxRetries > 0` se reintenta
solo ante HTTP 429, 5xx, timeout o error de red, con espera exponencial (0.5 s, 1 s, 2 s… hasta 8 s) o lo que
indique el header `Retry-After`. Los errores 4xx nunca se reintentan.

## Overrides de endpoints y versionado

Cada endpoint del SDK tiene un id (`repuve.getVehicle`, `repuve.getTheftReport`, `repuve.getOwner`) y una definición
en el registro `ENDPOINTS`. Se pueden sobreescribir `method`, `path`, `transport` y `version`.

**Para todo el cliente** (por ejemplo, si ApiMarket publica una versión nueva):

```ts
const client = new ApiMarketClient({
  endpoints: {
    'repuve.getVehicle': { path: '/api/v3/repuve/datos-vehiculo', version: 'v3' },
    'repuve.getTheftReport': { transport: 'query' },
  },
});

client.getEndpoint('repuve.getVehicle');
// { id: 'repuve.getVehicle', method: 'POST', path: '/api/v3/repuve/datos-vehiculo', transport: 'body', version: 'v3', ... }
```

**Solo para una llamada:**

```ts
await client.repuve.getVehicle({ placas: 'ABC1234' }, { path: '/api/v2/repuve/datos-vehiculo', transport: 'query' });
```

Prioridad: override de la llamada → override del cliente → registro del SDK.

### Límites

Para que un override no pueda filtrar el token ni romper el cliente, el SDK lanza `ApiMarketConfigError` si:

- `path` no empieza con `/api/` (o no es `/openapi.json`), es una URL absoluta, o contiene `..`, `//`, `\`, `?`,
  `#`, espacios o caracteres de control.
- `baseUrl` no es `https://` (solo se permite `http://` para `localhost`, `127.0.0.1` y `[::1]`), o incluye
  usuario/contraseña, query string o fragmento.
- `method` no es `GET`, `POST`, `PUT`, `PATCH` o `DELETE`.
- `transport` no es `body` o `query`.
- El id del endpoint no existe en el registro.

Además, los headers extra (`options.headers`) no pueden sobreescribir `Authorization`, `x-sandbox`, `Accept` ni
`Content-Type`.

## `fetch` personalizado

Puedes pasar tu propia implementación de `fetch` (por ejemplo, para usar un proxy o para pruebas):

```ts
const client = new ApiMarketClient({ fetch: miFetch });
```

## Endpoints no envueltos

```ts
const permisos = await client.request({ method: 'GET', path: '/api/v2/apimarket/permissions' });
const cp = await client.request({ method: 'POST', path: '/api/v2/codigos-postales', body: { cp: '06600' } });
```

`client.request()` aplica la misma configuración, límites y manejo de errores que los métodos tipados.
