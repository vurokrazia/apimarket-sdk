# Módulo REPUVE

El [Registro Público Vehicular (REPUVE)](https://www.repuve.gob.mx) depende del Secretariado Ejecutivo del Sistema
Nacional de Seguridad Pública. ApiMarket permite consultarlo por **placas** o por **número de serie (NIV/VIN)**.

Se accede con `client.repuve`.

## Parámetros comunes

Los tres métodos reciben los mismos parámetros (`VehicleLookupParams`). Se requiere **al menos uno**:

| Campo | Tipo | Validación local | Normalización |
|---|---|---|---|
| `placas` | `string` | 1–10 caracteres `A-Z 0-9` | Se quitan espacios y guiones; mayúsculas |
| `numero_serie` | `string` | 17 caracteres `A-Z 0-9` sin `I`, `O`, `Q` | Se quitan espacios; mayúsculas |

Si un valor no pasa la validación se lanza `ApiMarketValidationError` y **no** se llama a la API (no se gastan créditos).

Para vehículos antiguos con NIV de menos de 17 caracteres usa `skipFormatValidation`:

```ts
await client.repuve.getVehicle({ numero_serie: 'AB12345' }, { skipFormatValidation: true });
```

Helpers exportados: `isValidPlate()`, `isValidVin()`, `normalizePlate()` y `normalizeVin()`.

## Opciones por llamada (`RepuveCallOptions`)

| Opción | Tipo | Descripción |
|---|---|---|
| `apiKey` | `string` | Token solo para esta llamada |
| `sandbox` | `boolean` | Usar el sandbox (no consume créditos) |
| `timeoutMs` | `number` | Timeout por intento |
| `maxRetries` | `number` | Reintentos ante 429/5xx/timeout/red |
| `signal` | `AbortSignal` | Cancelar la petición |
| `headers` | `Record<string, string>` | Headers extra (no puede sobreescribir `Authorization`) |
| `path` | `string` | Ruta alternativa solo para esta llamada |
| `transport` | `'body' \| 'query'` | Enviar parámetros como JSON (default) o en el query string |
| `skipFormatValidation` | `boolean` | Omitir validación de formato local |

---

## `getVehicle(params, options?)`

Datos de registro del vehículo.

- **Endpoint:** `POST /api/repuve/grupo/datos-vehiculo`
- **Costo:** 1 crédito
- **Devuelve:** `ApiMarketResult<RepuveVehicle>`

```ts
const { found, data, message } = await client.repuve.getVehicle({ placas: 'ABC1234' });
```

| Campo | Descripción |
|---|---|
| `marca`, `modelo`, `anio`, `color` | Descripción del vehículo |
| `numero_serie`, `numero_motor` | NIV y número de motor |
| `placa`, `placa_anterior` | Placas actuales y anteriores |
| `tipo_vehiculo`, `carroceria`, `uso`, `capacidad_carga` | Clasificación |
| `estado_vehiculo` | Estatus en el padrón (por ejemplo `ACTIVO`) |
| `estado`, `ubicacion`, `codigo_ubicacion` | Entidad y ubicación del registro |
| `fecha_registro`, `lugar_registro`, `fecha_actualizacion` | Datos de inscripción |
| `folio_constancia_inscripcion`, `constancia_inscripcion` | Constancia de inscripción |
| `observaciones`, `comentarios` | Notas del registro |

**Sin datos:** si el vehículo no está inscrito, `found` es `false` y `message` lo explica
(por ejemplo: *"El vehículo con identificador: BMT789A no se encuentra inscrito en el Registro Público Vehicular."*).

---

## `getTheftReport(params, options?)`

Indica si el vehículo tiene reporte de robo.

- **Endpoint:** `POST /api/repuve/grupo/consulta-robo`
- **Costo:** 1 crédito
- **Devuelve:** `ApiMarketResult<RepuveTheftReport>`

```ts
const robo = await client.repuve.getTheftReport({ numero_serie: '4A3AK44T36E024814' });

if (!robo.found) {
  console.log('Sin reporte de robo');
} else if (robo.data.robado) {
  console.log('Robado. Fuente:', robo.data.fuente, 'NUC:', robo.data.nuc);
}
```

| Campo | Descripción |
|---|---|
| `robado` | `true` si hay reporte de robo |
| `fuente` | Quién levantó el reporte (por ejemplo `PGJ - JALISCO`) |
| `nuc` | Número Único de Caso |
| `agente_mp` | Agente del Ministerio Público |
| `fecha_registro`, `fecha_ultima_actualizacion` | Fechas del reporte |
| `placas`, `numero_serie` | Identificadores del vehículo |

**Sin reporte:** `found: false`, `data: null`.

---

## `getOwner(params, options?)`

Datos del propietario registrado.

- **Endpoint:** `POST /api/repuve/grupo/consulta-propietario`
- **Costo:** 1 crédito
- **Devuelve:** `ApiMarketResult<RepuveOwner>`

```ts
const propietario = await client.repuve.getOwner({ placas: 'ABC1234' });
```

| Campo | Descripción |
|---|---|
| `nombre_completo`, `rfc`, `curp` | Identidad |
| `fecha_nacimiento`, `estado_civil`, `genero`, `pais_origen` | Datos personales (suelen venir en `null`) |
| `estado`, `municipio`, `colonia`, `calle`, `numero_exterior`, `numero_interior`, `codigo_postal` | Domicilio |

> ⚠️ Son **datos personales**. Trátalos conforme a la LFPDPPP y a tu aviso de privacidad, y no los guardes en logs.

---

## Ejemplo: revisión completa de un vehículo

```ts
import { ApiMarketClient, isValidVin } from 'apimarket-sdk';

const client = new ApiMarketClient();

async function revisarVehiculo(identificador: string) {
  const params = isValidVin(identificador) ? { numero_serie: identificador } : { placas: identificador };

  const [vehiculo, robo] = await Promise.all([
    client.repuve.getVehicle(params),
    client.repuve.getTheftReport(params),
  ]);

  return {
    inscrito: vehiculo.found,
    vehiculo: vehiculo.data,
    robado: robo.found && robo.data?.robado === true,
    reporteRobo: robo.data,
  };
}
```

## Notas sobre la API de origen

- La colección de Postman de ApiMarket envía los parámetros como **cuerpo JSON** y el OpenAPI los declara en el
  **query string**. El SDK usa JSON por defecto; si la API cambia, usa `transport: 'query'` (por llamada o en el
  constructor con `endpoints`).
- ApiMarket publica el estado de cada servicio en su documentación (🟢 activo, 🟡 mantenimiento, 🔴 no disponible).
  Si REPUVE está en mantenimiento, es normal recibir `ApiMarketServerError` o respuestas sin datos.
- Usa `sandbox: true` mientras integras: la respuesta tiene el mismo formato y no consume créditos.
