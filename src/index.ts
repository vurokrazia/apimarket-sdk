export { ApiMarketClient } from './client.js';
export type { ApiMarketClientOptions, RawRequest } from './client.js';

export { RepuveResource } from './resources/repuve.js';

export { ENV_VARS, DEFAULTS, MAX_RETRIES_LIMIT } from './config.js';
export { ENDPOINTS } from './endpoints.js';
export type { EndpointDefinition, EndpointId, EndpointOverride, EndpointOverrides } from './endpoints.js';

export {
  ApiMarketError,
  ApiMarketConfigError,
  ApiMarketValidationError,
  ApiMarketAuthError,
  ApiMarketNotFoundError,
  ApiMarketRateLimitError,
  ApiMarketServerError,
  ApiMarketTimeoutError,
  ApiMarketNetworkError,
  ApiMarketResponseError,
} from './errors.js';
export type { ApiMarketErrorDetails } from './errors.js';

export { isValidPlate, isValidVin, normalizePlate, normalizeVin } from './validators/vehicle.js';

export type {
  ApiMarketEnvelope,
  ApiMarketResult,
  EndpointCallOptions,
  HttpMethod,
  QueryValue,
  RateLimitInfo,
  RequestOptions,
  Transport,
} from './types/common.js';
export type {
  RepuveCallOptions,
  RepuveOwner,
  RepuveTheftReport,
  RepuveVehicle,
  VehicleLookupParams,
} from './types/repuve.js';

export { SDK_VERSION } from './version.js';
