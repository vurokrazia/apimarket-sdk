import type { EndpointInvoker } from '../client.js';
import type { EndpointId } from '../endpoints.js';
import type { ApiMarketResult } from '../types/common.js';
import type {
  RepuveCallOptions,
  RepuveOwner,
  RepuveTheftReport,
  RepuveVehicle,
  VehicleLookupParams,
} from '../types/repuve.js';
import { normalizeVehicleParams } from '../validators/vehicle.js';

/**
 * Módulo REPUVE (Registro Público Vehicular).
 *
 * Todas las consultas aceptan `placas` y/o `numero_serie` (NIV) y consumen 1 crédito,
 * salvo en modo sandbox. Los parámetros se validan localmente antes de llamar a la API,
 * así que un dato mal formado no gasta créditos.
 *
 * @example
 * ```ts
 * const { found, data } = await client.repuve.getVehicle({ placas: 'ABC1234' });
 * ```
 */
export class RepuveResource {
  readonly #invoke: EndpointInvoker;

  /** @internal Se crea desde `ApiMarketClient`; no se instancia directamente. */
  constructor(invoke: EndpointInvoker) {
    this.#invoke = invoke;
  }

  /**
   * Consulta los datos de registro de un vehículo: marca, modelo, año, color, NIV, motor,
   * uso, estatus en el padrón y lugar/fecha de inscripción.
   *
   * Endpoint: `POST /api/repuve/grupo/datos-vehiculo` · 1 crédito.
   *
   * @param params - `placas` y/o `numero_serie`.
   * @param options - Opciones por llamada (token, sandbox, timeout, ruta, etc.).
   * @returns `found: false` si el vehículo no está inscrito en REPUVE.
   * @throws {ApiMarketValidationError} Si los parámetros no son válidos.
   * @throws {ApiMarketConfigError} Si no hay token configurado.
   */
  getVehicle(params: VehicleLookupParams, options?: RepuveCallOptions): Promise<ApiMarketResult<RepuveVehicle>> {
    return this.#call<RepuveVehicle>('repuve.getVehicle', params, options);
  }

  /**
   * Consulta si un vehículo tiene reporte de robo en REPUVE.
   *
   * Endpoint: `POST /api/repuve/grupo/consulta-robo` · 1 crédito.
   *
   * @param params - `placas` y/o `numero_serie`.
   * @param options - Opciones por llamada.
   * @returns `found: false` cuando **no** hay reporte de robo. Si hay reporte, `data.robado` es `true`
   *   y trae la fuente y el NUC.
   */
  getTheftReport(
    params: VehicleLookupParams,
    options?: RepuveCallOptions,
  ): Promise<ApiMarketResult<RepuveTheftReport>> {
    return this.#call<RepuveTheftReport>('repuve.getTheftReport', params, options);
  }

  /**
   * Consulta los datos del propietario registrado de un vehículo: nombre, RFC y domicilio.
   *
   * Endpoint: `POST /api/repuve/grupo/consulta-propietario` · 1 crédito.
   *
   * > Estos son datos personales. Úsalos conforme a la LFPDPPP y a tu aviso de privacidad.
   *
   * @param params - `placas` y/o `numero_serie`.
   * @param options - Opciones por llamada.
   * @returns `found: false` si no hay propietario registrado.
   */
  getOwner(params: VehicleLookupParams, options?: RepuveCallOptions): Promise<ApiMarketResult<RepuveOwner>> {
    return this.#call<RepuveOwner>('repuve.getOwner', params, options);
  }

  async #call<T>(
    id: EndpointId,
    params: VehicleLookupParams,
    options: RepuveCallOptions = {},
  ): Promise<ApiMarketResult<T>> {
    const { skipFormatValidation, ...callOptions } = options;
    const payload = normalizeVehicleParams(params, skipFormatValidation);
    return this.#invoke<T>(id, payload, callOptions);
  }
}
