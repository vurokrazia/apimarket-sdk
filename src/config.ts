import { ApiMarketConfigError } from './errors.js';
import type { HttpMethod } from './types/common.js';

/** Nombres de las variables de entorno que lee el SDK. */
export const ENV_VARS = {
  apiKey: 'APIMARKET_API_KEY',
  baseUrl: 'APIMARKET_BASE_URL',
  sandbox: 'APIMARKET_SANDBOX',
  timeoutMs: 'APIMARKET_TIMEOUT_MS',
  maxRetries: 'APIMARKET_MAX_RETRIES',
} as const;

/** Valores por defecto cuando no hay argumento ni variable de entorno. */
export const DEFAULTS = {
  baseUrl: 'https://apimarket.mx',
  sandbox: false,
  timeoutMs: 30_000,
  maxRetries: 0,
} as const;

/** Límite superior de reintentos, para evitar gastar créditos sin control. */
export const MAX_RETRIES_LIMIT = 5;

/** Opciones de configuración comunes al constructor y a cada llamada. */
export interface ConfigOptions {
  apiKey?: string;
  baseUrl?: string;
  sandbox?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

/** Configuración final que se usa para una petición. */
export interface ResolvedConfig {
  apiKey: string;
  baseUrl: string;
  sandbox: boolean;
  timeoutMs: number;
  maxRetries: number;
}

const ALLOWED_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function readEnv(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function parseBooleanEnv(name: string, value: string): boolean {
  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  throw new ApiMarketConfigError(`La variable ${name} debe ser "true" o "false" (valor recibido: "${value}").`);
}

function parseIntegerEnv(name: string, value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new ApiMarketConfigError(`La variable ${name} debe ser un entero positivo (valor recibido: "${value}").`);
  }
  return Number(value);
}

function assertInteger(name: string, value: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ApiMarketConfigError(`"${name}" debe ser un entero entre ${min} y ${max}.`);
  }
  return value;
}

/**
 * Valida y normaliza la URL base. Solo se acepta `https://`, salvo `http://localhost`
 * (o `127.0.0.1` / `[::1]`) para pruebas locales. Se elimina la `/` final.
 */
export function validateBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ApiMarketConfigError(`"baseUrl" no es una URL válida: "${baseUrl}".`);
  }
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new ApiMarketConfigError('"baseUrl" debe usar https:// (solo se permite http:// para localhost).');
  }
  if (url.username || url.password) {
    throw new ApiMarketConfigError('"baseUrl" no debe incluir usuario ni contraseña.');
  }
  if (url.search || url.hash) {
    throw new ApiMarketConfigError('"baseUrl" no debe incluir query string ni fragmento.');
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/**
 * Valida la ruta de un endpoint. Debe ser relativa a `baseUrl`, empezar con `/api/`
 * (o ser `/openapi.json`) y no contener `..`, `//`, `\`, `?`, `#` ni caracteres de control.
 * Así se garantiza que el token solo se envía al host configurado.
 */
export function validatePath(path: string): string {
  if (typeof path !== 'string' || path.length === 0) {
    throw new ApiMarketConfigError('La ruta del endpoint debe ser un texto no vacío.');
  }
  const invalid =
    !(path.startsWith('/api/') || path === '/openapi.json') ||
    path.includes('..') ||
    path.includes('//') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#') ||
    /[\u0000-\u001f\u007f\s]/.test(path);
  if (invalid) {
    throw new ApiMarketConfigError(
      `Ruta de endpoint no permitida: "${path}". Debe ser relativa y empezar con "/api/", sin "..", "//", "?" ni "#".`,
    );
  }
  return path;
}

/** Valida que el método HTTP sea uno de los permitidos. */
export function validateMethod(method: string): HttpMethod {
  const upper = String(method).toUpperCase() as HttpMethod;
  if (!ALLOWED_METHODS.includes(upper)) {
    throw new ApiMarketConfigError(`Método HTTP no permitido: "${method}". Usa ${ALLOWED_METHODS.join(', ')}.`);
  }
  return upper;
}

/**
 * Resuelve la configuración de una petición.
 *
 * Precedencia: **opción por llamada → opción del constructor → variable de entorno → valor por defecto.**
 * Las variables de entorno se leen en el momento de la llamada.
 *
 * @throws {ApiMarketConfigError} Si no hay token o algún valor es inválido.
 */
export function resolveConfig(client: ConfigOptions = {}, call: ConfigOptions = {}): ResolvedConfig {
  const apiKey = call.apiKey ?? client.apiKey ?? readEnv(ENV_VARS.apiKey);
  if (apiKey === undefined || apiKey.trim() === '') {
    throw new ApiMarketConfigError(
      `No se encontró el token de ApiMarket. Pásalo como opción "apiKey" o define la variable de entorno ${ENV_VARS.apiKey}.`,
    );
  }

  const envSandbox = readEnv(ENV_VARS.sandbox);
  const envTimeout = readEnv(ENV_VARS.timeoutMs);
  const envRetries = readEnv(ENV_VARS.maxRetries);

  const baseUrl = call.baseUrl ?? client.baseUrl ?? readEnv(ENV_VARS.baseUrl) ?? DEFAULTS.baseUrl;
  const sandbox =
    call.sandbox ??
    client.sandbox ??
    (envSandbox !== undefined ? parseBooleanEnv(ENV_VARS.sandbox, envSandbox) : DEFAULTS.sandbox);
  const timeoutMs =
    call.timeoutMs ??
    client.timeoutMs ??
    (envTimeout !== undefined ? parseIntegerEnv(ENV_VARS.timeoutMs, envTimeout) : DEFAULTS.timeoutMs);
  const maxRetries =
    call.maxRetries ??
    client.maxRetries ??
    (envRetries !== undefined ? parseIntegerEnv(ENV_VARS.maxRetries, envRetries) : DEFAULTS.maxRetries);

  return {
    apiKey: apiKey.trim(),
    baseUrl: validateBaseUrl(baseUrl),
    sandbox: Boolean(sandbox),
    timeoutMs: assertInteger('timeoutMs', timeoutMs, 1),
    maxRetries: assertInteger('maxRetries', maxRetries, 0, MAX_RETRIES_LIMIT),
  };
}
