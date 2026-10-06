import { resolveConfig, validateBaseUrl, validateMethod, validatePath, type ConfigOptions } from './config.js';
import {
  resolveEndpoint,
  validateEndpointOverrides,
  type EndpointDefinition,
  type EndpointId,
  type EndpointOverrides,
} from './endpoints.js';
import { ApiMarketConfigError } from './errors.js';
import { executeRequest, type FetchLike } from './http.js';
import { RepuveResource } from './resources/repuve.js';
import type {
  ApiMarketResult,
  EndpointCallOptions,
  HttpMethod,
  QueryValue,
  RequestOptions,
} from './types/common.js';

/** Opciones del constructor de `ApiMarketClient`. Todas son opcionales. */
export interface ApiMarketClientOptions extends ConfigOptions {
  /**
   * Token de ApiMarket. Si no se pasa, se lee `APIMARKET_API_KEY` **en cada llamada**.
   */
  apiKey?: string;
  /** URL base. Default: `APIMARKET_BASE_URL` o `https://apimarket.mx`. */
  baseUrl?: string;
  /** Usar el sandbox (no consume créditos). Default: `APIMARKET_SANDBOX` o `false`. */
  sandbox?: boolean;
  /** Timeout por intento en ms. Default: `APIMARKET_TIMEOUT_MS` o `30000`. */
  timeoutMs?: number;
  /** Reintentos ante 429/5xx/timeout/red (máx. 5). Default: `APIMARKET_MAX_RETRIES` o `0`. */
  maxRetries?: number;
  /**
   * Sobreescribe método, ruta o transporte de endpoints registrados, por ejemplo para apuntar a una
   * nueva versión de la API sin esperar a una nueva versión del SDK.
   */
  endpoints?: EndpointOverrides;
  /** Implementación de `fetch` a usar (por defecto, la global de Node 18+). */
  fetch?: FetchLike;
}

/** Petición libre para endpoints que el SDK todavía no envuelve. */
export interface RawRequest {
  method: HttpMethod;
  /** Ruta relativa a `baseUrl`; debe empezar con `/api/`. */
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

/** @internal Función que usan los recursos para llamar a un endpoint del registro. */
export type EndpointInvoker = <T>(
  id: EndpointId,
  params: Record<string, QueryValue>,
  options?: EndpointCallOptions,
) => Promise<ApiMarketResult<T>>;

/**
 * Cliente de ApiMarket.
 *
 * @example
 * ```ts
 * import { ApiMarketClient } from 'apimarket-sdk';
 *
 * const client = new ApiMarketClient(); // usa APIMARKET_API_KEY
 * const vehiculo = await client.repuve.getVehicle({ placas: 'ABC1234' });
 * ```
 */
export class ApiMarketClient {
  /** Consultas al Registro Público Vehicular (REPUVE). */
  readonly repuve: RepuveResource;

  readonly #options: ConfigOptions;
  readonly #endpoints: EndpointOverrides;
  readonly #fetch: FetchLike | undefined;

  /**
   * @param options - Configuración del cliente. Lo que no se pase se toma de las variables de entorno.
   * @throws {ApiMarketConfigError} Si `baseUrl` o `endpoints` son inválidos.
   */
  constructor(options: ApiMarketClientOptions = {}) {
    const { endpoints, fetch: fetchImpl, ...config } = options;
    if (config.baseUrl !== undefined) validateBaseUrl(config.baseUrl);
    this.#options = config;
    this.#endpoints = validateEndpointOverrides(endpoints);
    this.#fetch = fetchImpl;

    const invoke: EndpointInvoker = (id, params, callOptions) => this.#invokeEndpoint(id, params, callOptions);
    this.repuve = new RepuveResource(invoke);
  }

  /**
   * Devuelve la definición efectiva de un endpoint (registro + overrides del cliente).
   * Útil para inspeccionar a qué ruta apunta cada método.
   */
  getEndpoint(id: EndpointId): EndpointDefinition {
    return resolveEndpoint(id, this.#endpoints);
  }

  /**
   * Llama a cualquier endpoint de ApiMarket que el SDK todavía no envuelve, con la misma
   * autenticación, timeouts y manejo de errores.
   *
   * @example
   * ```ts
   * const saldo = await client.request({ method: 'GET', path: '/api/balance' });
   * ```
   * @throws {ApiMarketConfigError} Si la ruta o el método no están permitidos.
   */
  request<T = unknown>(request: RawRequest, options: RequestOptions = {}): Promise<ApiMarketResult<T>> {
    const method = validateMethod(request.method);
    const path = validatePath(request.path);
    return this.#send<T>(
      { method, path, query: request.query, body: request.body, endpoint: `${method} ${path}` },
      options,
    );
  }

  #invokeEndpoint<T>(
    id: EndpointId,
    params: Record<string, QueryValue>,
    options: EndpointCallOptions = {},
  ): Promise<ApiMarketResult<T>> {
    const { path, transport, ...requestOptions } = options;
    const endpoint = resolveEndpoint(id, this.#endpoints, { path, transport });
    const useQuery = endpoint.transport === 'query' || endpoint.method === 'GET';
    return this.#send<T>(
      {
        method: endpoint.method,
        path: endpoint.path,
        query: useQuery ? params : undefined,
        body: useQuery ? undefined : params,
        endpoint: id,
      },
      requestOptions,
    );
  }

  #send<T>(
    request: { method: HttpMethod; path: string; query?: Record<string, QueryValue>; body?: unknown; endpoint: string },
    options: RequestOptions,
  ): Promise<ApiMarketResult<T>> {
    const { signal, headers, ...callConfig } = options;
    const config = resolveConfig(this.#options, callConfig);
    const fetchImpl = this.#fetch ?? (globalThis.fetch as FetchLike | undefined);
    if (typeof fetchImpl !== 'function') {
      throw new ApiMarketConfigError('No hay una implementación de fetch disponible. Usa Node 18+ o pasa la opción "fetch".');
    }
    return executeRequest<T>({ ...request, signal, headers }, config, fetchImpl);
  }
}
