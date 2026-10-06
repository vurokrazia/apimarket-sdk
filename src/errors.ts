/**
 * Datos opcionales que acompañan a cualquier error del SDK.
 */
export interface ApiMarketErrorDetails {
  /** Status HTTP de la respuesta, si hubo respuesta. */
  status?: number;
  /** Folio único que ApiMarket asigna a cada petición (`codigoValidacion`). */
  codigoValidacion?: string;
  /** Id del endpoint del SDK que se estaba llamando (por ejemplo `repuve.getVehicle`). */
  endpoint?: string;
  /** Cuerpo de la respuesta (JSON parseado o texto). Nunca contiene el token. */
  body?: unknown;
  /** Error original que provocó este error. */
  cause?: unknown;
}

/**
 * Error base del SDK. Todos los errores que lanza `apimarket-sdk` heredan de esta clase,
 * así que basta con `instanceof ApiMarketError` para atraparlos todos.
 */
export class ApiMarketError extends Error {
  readonly status?: number;
  readonly codigoValidacion?: string;
  readonly endpoint?: string;
  readonly body?: unknown;

  constructor(message: string, details: ApiMarketErrorDetails = {}) {
    super(message, details.cause !== undefined ? { cause: details.cause } : undefined);
    this.name = new.target.name;
    this.status = details.status;
    this.codigoValidacion = details.codigoValidacion;
    this.endpoint = details.endpoint;
    this.body = details.body;
  }

  /** Representación serializable del error (útil para logs). */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      codigoValidacion: this.codigoValidacion,
      endpoint: this.endpoint,
      body: this.body,
    };
  }
}

/** Configuración inválida o faltante (por ejemplo, no hay `APIMARKET_API_KEY`). Se lanza antes de hacer la petición. */
export class ApiMarketConfigError extends ApiMarketError {}

/** Parámetros inválidos: validación local del SDK o HTTP 400/422 de la API. */
export class ApiMarketValidationError extends ApiMarketError {}

/** HTTP 401/403: token inválido, expirado o sin permiso para el endpoint. */
export class ApiMarketAuthError extends ApiMarketError {}

/** HTTP 404 con cuerpo de error (ruta inexistente o recurso no encontrado). */
export class ApiMarketNotFoundError extends ApiMarketError {}

/** HTTP 429: se excedió el límite de peticiones. */
export class ApiMarketRateLimitError extends ApiMarketError {
  /** Segundos sugeridos por el header `Retry-After`, si vino. */
  readonly retryAfter?: number;

  constructor(message: string, details: ApiMarketErrorDetails & { retryAfter?: number } = {}) {
    super(message, details);
    this.retryAfter = details.retryAfter;
  }

  override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), retryAfter: this.retryAfter };
  }
}

/** HTTP 5xx: error del lado de ApiMarket o de la fuente de origen. */
export class ApiMarketServerError extends ApiMarketError {}

/** La petición superó `timeoutMs`. */
export class ApiMarketTimeoutError extends ApiMarketError {}

/** Fallo de red (DNS, conexión rechazada, TLS, etc.). */
export class ApiMarketNetworkError extends ApiMarketError {}

/** Respuesta inesperada: no es JSON válido o trae `success: false` sin un status de error reconocible. */
export class ApiMarketResponseError extends ApiMarketError {}
