/** Métodos HTTP permitidos por el SDK. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Cómo se envían los parámetros de un endpoint:
 * - `body`: cuerpo JSON (`Content-Type: application/json`).
 * - `query`: query string (`?placas=...`).
 */
export type Transport = 'body' | 'query';

/** Valores aceptados en el query string. Los `undefined`/`null` se omiten. */
export type QueryValue = string | number | boolean | null | undefined;

/** Información de los headers `X-RateLimit-*` de la respuesta. */
export interface RateLimitInfo {
  /** Peticiones permitidas en la ventana actual (`X-RateLimit-Limit`). */
  limit: number | null;
  /** Peticiones restantes en la ventana actual (`X-RateLimit-Remaining`). */
  remaining: number | null;
}

/** Cuerpo estándar que devuelve ApiMarket. */
export interface ApiMarketEnvelope<T = unknown> {
  success: boolean;
  codigoValidacion?: string;
  message?: string;
  status?: number;
  data?: T;
  [key: string]: unknown;
}

/**
 * Resultado normalizado de cualquier llamada del SDK.
 *
 * @typeParam T - Tipo de `data` cuando la consulta encontró información.
 */
export interface ApiMarketResult<T> {
  /**
   * `true` si la API devolvió información. `false` cuando respondió "sin datos"
   * (ApiMarket lo indica con HTTP 200, `success: true` y `data` vacío o solo con `ayuda`).
   */
  found: boolean;
  /** Datos de la respuesta, o `null` cuando `found` es `false`. */
  data: T | null;
  /** Mensaje de la API (por ejemplo `"Exito"` o la explicación de por qué no hay datos). */
  message: string;
  /** Folio único de la petición en ApiMarket. Útil para soporte y auditoría. */
  codigoValidacion: string | null;
  /** Status HTTP de la respuesta. */
  status: number;
  /** Límites de peticiones informados por la API. */
  rateLimit: RateLimitInfo;
  /** Cuerpo original de la respuesta, sin modificar. */
  raw: unknown;
}

/**
 * Opciones que se pueden pasar en cada llamada. Tienen prioridad sobre las del constructor
 * y sobre las variables de entorno.
 */
export interface RequestOptions {
  /** Token de ApiMarket. Si no se pasa, se usa el del constructor o `APIMARKET_API_KEY`. */
  apiKey?: string;
  /** URL base. Si no se pasa, se usa la del constructor, `APIMARKET_BASE_URL` o `https://apimarket.mx`. */
  baseUrl?: string;
  /** Usar el sandbox de ApiMarket (header `x-sandbox: true`, no consume créditos). */
  sandbox?: boolean;
  /** Tiempo máximo de espera por intento, en milisegundos. */
  timeoutMs?: number;
  /** Reintentos ante 429, 5xx, timeout o error de red. Cada intento puede consumir créditos. */
  maxRetries?: number;
  /** Señal para cancelar la petición. */
  signal?: AbortSignal;
  /**
   * Headers extra. No se pueden sobreescribir `Authorization`, `x-sandbox`, `Accept` ni `Content-Type`.
   */
  headers?: Record<string, string>;
}

/** Opciones por llamada para métodos que envuelven un endpoint del registro. */
export interface EndpointCallOptions extends RequestOptions {
  /** Ruta a usar solo en esta llamada (por ejemplo `/api/v2/repuve/datos-vehiculo`). Debe empezar con `/api/`. */
  path?: string;
  /** Transporte a usar solo en esta llamada. */
  transport?: Transport;
}
