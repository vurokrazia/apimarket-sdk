import { ApiMarketValidationError } from '../errors.js';
import type { VehicleLookupParams } from '../types/repuve.js';

/** Placas: 1 a 10 caracteres alfanuméricos (después de quitar espacios y guiones). */
export const PLATE_PATTERN = /^[A-Z0-9]{1,10}$/;

/** NIV/VIN: 17 caracteres alfanuméricos sin I, O ni Q (ISO 3779). */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Normaliza placas: quita espacios y guiones y convierte a mayúsculas. */
export function normalizePlate(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

/** Normaliza un NIV: quita espacios y convierte a mayúsculas. */
export function normalizeVin(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** Indica si un texto es un NIV/VIN de 17 caracteres válido. */
export function isValidVin(value: string): boolean {
  return VIN_PATTERN.test(normalizeVin(value));
}

/** Indica si un texto tiene formato de placas válido. */
export function isValidPlate(value: string): boolean {
  return PLATE_PATTERN.test(normalizePlate(value));
}

/**
 * Valida y normaliza los parámetros de búsqueda de un vehículo.
 *
 * @param params - `placas` y/o `numero_serie`; se requiere al menos uno.
 * @param skipFormatValidation - Si es `true`, solo se exige que haya algún valor no vacío
 *   (útil para placas o series antiguas con formatos no estándar).
 * @throws {ApiMarketValidationError}
 */
export function normalizeVehicleParams(
  params: VehicleLookupParams,
  skipFormatValidation = false,
): { placas?: string; numero_serie?: string } {
  if (typeof params !== 'object' || params === null) {
    throw new ApiMarketValidationError('Se esperaba un objeto con "placas" o "numero_serie".');
  }

  const result: { placas?: string; numero_serie?: string } = {};

  if (params.placas !== undefined && params.placas !== null) {
    if (typeof params.placas !== 'string') {
      throw new ApiMarketValidationError('"placas" debe ser un texto.');
    }
    const placas = normalizePlate(params.placas);
    if (placas.length > 0) {
      if (!skipFormatValidation && !PLATE_PATTERN.test(placas)) {
        throw new ApiMarketValidationError(
          `"placas" inválidas: "${params.placas}". Deben tener de 1 a 10 caracteres alfanuméricos.`,
        );
      }
      result.placas = placas;
    }
  }

  if (params.numero_serie !== undefined && params.numero_serie !== null) {
    if (typeof params.numero_serie !== 'string') {
      throw new ApiMarketValidationError('"numero_serie" debe ser un texto.');
    }
    const numeroSerie = normalizeVin(params.numero_serie);
    if (numeroSerie.length > 0) {
      if (!skipFormatValidation && !VIN_PATTERN.test(numeroSerie)) {
        throw new ApiMarketValidationError(
          `"numero_serie" inválido: "${params.numero_serie}". Debe ser un NIV de 17 caracteres sin las letras I, O ni Q.`,
        );
      }
      result.numero_serie = numeroSerie;
    }
  }

  if (result.placas === undefined && result.numero_serie === undefined) {
    throw new ApiMarketValidationError('Debes enviar al menos "placas" o "numero_serie".');
  }

  return result;
}
