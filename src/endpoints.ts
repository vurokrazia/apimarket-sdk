import { ApiMarketConfigError } from './errors.js';
import { validateMethod, validatePath } from './config.js';
import type { HttpMethod, Transport } from './types/common.js';

/** Definición de un endpoint de ApiMarket envuelto por el SDK. */
export interface EndpointDefinition {
  /** Id estable del endpoint dentro del SDK (`<modulo>.<metodo>`). */
  id: string;
  method: HttpMethod;
  /** Ruta relativa a `baseUrl`. */
  path: string;
  /** Cómo se envían los parámetros. */
  transport: Transport;
  /** Créditos que consume cada llamada exitosa (según el OpenAPI de ApiMarket). */
  credits: number;
  /** Versión de la API a la que apunta la ruta, o `null` si la ruta no está versionada. */
  version: string | null;
  /** Descripción corta. */
  description: string;
}

/**
 * Registro de endpoints soportados por el SDK.
 * Para agregar un módulo nuevo basta con registrar aquí sus endpoints y crear su recurso.
 */
export const ENDPOINTS = {
  'repuve.getVehicle': {
    id: 'repuve.getVehicle',
    method: 'POST',
    path: '/api/repuve/grupo/datos-vehiculo',
    transport: 'body',
    credits: 1,
    version: null,
    description: 'Datos de registro de un vehículo en REPUVE por placas o NIV.',
  },
  'repuve.getTheftReport': {
    id: 'repuve.getTheftReport',
    method: 'POST',
    path: '/api/repuve/grupo/consulta-robo',
    transport: 'body',
    credits: 1,
    version: null,
    description: 'Reporte de robo de un vehículo en REPUVE por placas o NIV.',
  },
  'repuve.getOwner': {
    id: 'repuve.getOwner',
    method: 'POST',
    path: '/api/repuve/grupo/consulta-propietario',
    transport: 'body',
    credits: 1,
    version: null,
    description: 'Datos del propietario de un vehículo en REPUVE por placas o NIV.',
  },
} as const satisfies Record<string, EndpointDefinition>;

/** Ids de los endpoints registrados. */
export type EndpointId = keyof typeof ENDPOINTS;

/** Campos de un endpoint que se pueden sobreescribir. */
export interface EndpointOverride {
  method?: HttpMethod;
  path?: string;
  transport?: Transport;
  version?: string | null;
}

/** Overrides por id de endpoint, para todo el cliente. */
export type EndpointOverrides = Partial<Record<EndpointId, EndpointOverride>>;

function validateTransport(transport: string): Transport {
  if (transport !== 'body' && transport !== 'query') {
    throw new ApiMarketConfigError(`Transporte no permitido: "${transport}". Usa "body" o "query".`);
  }
  return transport;
}

/** Indica si un id corresponde a un endpoint registrado. */
export function isEndpointId(id: string): id is EndpointId {
  return Object.prototype.hasOwnProperty.call(ENDPOINTS, id);
}

/**
 * Valida los overrides del constructor: ids conocidos y valores permitidos.
 *
 * @throws {ApiMarketConfigError}
 */
export function validateEndpointOverrides(overrides: EndpointOverrides | undefined): EndpointOverrides {
  if (overrides === undefined) return {};
  if (typeof overrides !== 'object' || overrides === null) {
    throw new ApiMarketConfigError('"endpoints" debe ser un objeto { [id]: override }.');
  }
  const result: EndpointOverrides = {};
  for (const [id, override] of Object.entries(overrides)) {
    if (!isEndpointId(id)) {
      throw new ApiMarketConfigError(
        `Endpoint desconocido en "endpoints": "${id}". Ids válidos: ${Object.keys(ENDPOINTS).join(', ')}.`,
      );
    }
    if (override === undefined) continue;
    result[id] = {
      ...(override.method !== undefined && { method: validateMethod(override.method) }),
      ...(override.path !== undefined && { path: validatePath(override.path) }),
      ...(override.transport !== undefined && { transport: validateTransport(override.transport) }),
      ...(override.version !== undefined && { version: override.version }),
    };
  }
  return result;
}

/**
 * Obtiene la definición final de un endpoint aplicando, en orden:
 * registro → override del cliente → override de la llamada.
 */
export function resolveEndpoint(
  id: EndpointId,
  clientOverrides: EndpointOverrides = {},
  callOverride: Pick<EndpointOverride, 'path' | 'transport'> = {},
): EndpointDefinition {
  const base: EndpointDefinition = ENDPOINTS[id];
  const merged: EndpointDefinition = { ...base, ...clientOverrides[id] };
  if (callOverride.path !== undefined) merged.path = validatePath(callOverride.path);
  if (callOverride.transport !== undefined) merged.transport = validateTransport(callOverride.transport);
  return merged;
}
