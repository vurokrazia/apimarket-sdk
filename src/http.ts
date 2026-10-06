import type { ResolvedConfig } from './config.js';
import {
  ApiMarketAuthError,
  ApiMarketError,
  ApiMarketNetworkError,
  ApiMarketNotFoundError,
  ApiMarketRateLimitError,
  ApiMarketResponseError,
  ApiMarketServerError,
  ApiMarketTimeoutError,
  ApiMarketValidationError,
  type ApiMarketErrorDetails,
} from './errors.js';
import type { ApiMarketResult, HttpMethod, QueryValue, RateLimitInfo } from './types/common.js';
import { SDK_VERSION } from './version.js';

/** Petición ya resuelta, lista para enviarse. */
export interface HttpRequest {
  method: HttpMethod;
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Id del endpoint, para los mensajes de error. */
  endpoint?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const PROTECTED_HEADERS = new Set(['authorization', 'x-sandbox', 'accept', 'content-type']);
const MAX_BACKOFF_MS = 8_000;

/** Construye la URL final a partir de `baseUrl`, la ruta y el query string. */
export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.append(key, String(value));
    }
  }
  return url.toString();
}

function parseIntHeader(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function readRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: parseIntHeader(headers, 'x-ratelimit-limit'),
    remaining: parseIntHeader(headers, 'x-ratelimit-remaining'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * ApiMarket indica "sin datos" con `success: true` y `data` vacío (`[]`, `{}`, `null`)
 * o con un objeto que solo trae el texto de `ayuda`.
 */
export function isEmptyData(data: unknown): boolean {
  if (data === undefined || data === null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (isRecord(data)) {
    const keys = Object.keys(data);
    return keys.length === 0 || keys.every((key) => key === 'ayuda');
  }
  return false;
}

function errorFromStatus(status: number, message: string, details: ApiMarketErrorDetails, retryAfter?: number) {
  if (status === 400 || status === 422) return new ApiMarketValidationError(message, details);
  if (status === 401 || status === 403) return new ApiMarketAuthError(message, details);
  if (status === 404) return new ApiMarketNotFoundError(message, details);
  if (status === 429) return new ApiMarketRateLimitError(message, { ...details, retryAfter });
  if (status >= 500) return new ApiMarketServerError(message, details);
  return new ApiMarketResponseError(message, details);
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof ApiMarketServerError ||
    error instanceof ApiMarketRateLimitError ||
    error instanceof ApiMarketTimeoutError ||
    error instanceof ApiMarketNetworkError
  );
}

function backoffMs(attempt: number, error: unknown): number {
  if (error instanceof ApiMarketRateLimitError && error.retryAfter !== undefined) {
    return Math.min(error.retryAfter * 1000, MAX_BACKOFF_MS);
  }
  return Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function buildHeaders(request: HttpRequest, config: ResolvedConfig, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers ?? {})) {
    if (!PROTECTED_HEADERS.has(key.toLowerCase())) headers[key] = value;
  }
  headers['Accept'] = 'application/json';
  headers['Authorization'] = `Bearer ${config.apiKey}`;
  if (!Object.keys(headers).some((key) => key.toLowerCase() === 'user-agent')) {
    headers['User-Agent'] = `apimarket-sdk/${SDK_VERSION}`;
  }
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (config.sandbox) headers['x-sandbox'] = 'true';
  return headers;
}

async function sendOnce<T>(
  request: HttpRequest,
  config: ResolvedConfig,
  fetchImpl: FetchLike,
): Promise<ApiMarketResult<T>> {
  const hasBody = request.body !== undefined && request.method !== 'GET';
  const url = buildUrl(config.baseUrl, request.path, request.query);
  const endpoint = request.endpoint;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  const onUserAbort = () => controller.abort(request.signal?.reason);
  if (request.signal?.aborted) onUserAbort();
  request.signal?.addEventListener('abort', onUserAbort, { once: true });

  let response: Response;
  let text: string;
  try {
    response = await fetchImpl(url, {
      method: request.method,
      headers: buildHeaders(request, config, hasBody),
      body: hasBody ? JSON.stringify(request.body) : undefined,
      signal: controller.signal,
    });
    text = await response.text();
  } catch (cause) {
    if (timedOut) {
      throw new ApiMarketTimeoutError(`La petición superó el tiempo límite de ${config.timeoutMs} ms.`, {
        endpoint,
        cause,
      });
    }
    if (request.signal?.aborted) throw request.signal.reason ?? cause;
    throw new ApiMarketNetworkError('No se pudo conectar con ApiMarket.', { endpoint, cause });
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener('abort', onUserAbort);
  }

  const rateLimit = readRateLimit(response.headers);
  let body: unknown = text;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  const envelope = isRecord(body) ? body : undefined;
  const codigoValidacion = typeof envelope?.codigoValidacion === 'string' ? envelope.codigoValidacion : undefined;
  const apiMessage = typeof envelope?.message === 'string' ? envelope.message : undefined;
  const details: ApiMarketErrorDetails = { status: response.status, codigoValidacion, endpoint, body };

  // ApiMarket a veces responde 404 con `success: true` para indicar "sin datos".
  const notFoundButSuccessful = response.status === 404 && envelope?.success === true;

  if (!response.ok && !notFoundButSuccessful) {
    const retryAfter = parseIntHeader(response.headers, 'retry-after') ?? undefined;
    throw errorFromStatus(
      response.status,
      apiMessage ?? `ApiMarket respondió con HTTP ${response.status}.`,
      details,
      retryAfter,
    );
  }

  if (!envelope) {
    throw new ApiMarketResponseError('La respuesta de ApiMarket no es un objeto JSON válido.', details);
  }

  if (envelope.success === false) {
    const innerStatus = typeof envelope.status === 'number' ? envelope.status : response.status;
    throw errorFromStatus(
      innerStatus >= 400 ? innerStatus : 0,
      apiMessage ?? 'ApiMarket respondió success: false.',
      details,
    );
  }

  // Algunos endpoints administrativos no usan el sobre { success, data }: se devuelve el cuerpo completo.
  const data = 'data' in envelope ? envelope.data : 'success' in envelope ? undefined : envelope;
  const base = {
    message: apiMessage ?? '',
    codigoValidacion: codigoValidacion ?? null,
    status: response.status,
    rateLimit,
    raw: body,
  };
  if (notFoundButSuccessful || isEmptyData(data)) return { ...base, found: false, data: null };
  return { ...base, found: true, data: data as T };
}

/**
 * Envía una petición a ApiMarket con timeout, reintentos opcionales y mapeo de errores.
 *
 * @throws {ApiMarketError} Alguna de sus subclases según el tipo de falla.
 */
export async function executeRequest<T>(
  request: HttpRequest,
  config: ResolvedConfig,
  fetchImpl: FetchLike,
): Promise<ApiMarketResult<T>> {
  let attempt = 0;
  for (;;) {
    try {
      return await sendOnce<T>(request, config, fetchImpl);
    } catch (error) {
      if (!(error instanceof ApiMarketError) || !isRetryable(error) || attempt >= config.maxRetries) throw error;
      await sleep(backoffMs(attempt, error), request.signal);
      attempt += 1;
    }
  }
}
