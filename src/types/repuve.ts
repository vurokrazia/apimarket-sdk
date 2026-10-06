import type { EndpointCallOptions } from './common.js';

/**
 * Parámetros para buscar un vehículo en REPUVE. Se requiere **al menos uno**.
 * Si se envían ambos, la API los usa juntos.
 */
export interface VehicleLookupParams {
  /** Placas o matrícula (máximo 10 caracteres; se eliminan espacios y guiones). */
  placas?: string | null;
  /** Número de Identificación Vehicular (NIV/VIN), 17 caracteres. */
  numero_serie?: string | null;
}

/** Opciones por llamada para los métodos de REPUVE. */
export interface RepuveCallOptions extends EndpointCallOptions {
  /**
   * Omite la validación de formato local de placas y NIV (solo exige que haya algún valor).
   * Útil para vehículos antiguos con NIV de menos de 17 caracteres.
   */
  skipFormatValidation?: boolean;
}

/**
 * Datos de registro de un vehículo (`repuve.getVehicle`).
 * Los nombres de campo son los que devuelve ApiMarket; pueden llegar en `null`.
 */
export interface RepuveVehicle {
  fecha_registro?: string | null;
  lugar_registro?: string | null;
  numero_serie?: string | null;
  placa?: string | null;
  placa_anterior?: string | null;
  numero_motor?: string | null;
  anio?: string | null;
  color?: string | null;
  tipo_vehiculo?: string | null;
  estado?: string | null;
  marca?: string | null;
  modelo?: string | null;
  uso?: string | null;
  carroceria?: string | null;
  /** Estatus del vehículo en el padrón (por ejemplo `ACTIVO`). */
  estado_vehiculo?: string | null;
  capacidad_carga?: string | null;
  ubicacion?: string | null;
  codigo_ubicacion?: string | null;
  fecha_actualizacion?: string | null;
  folio_constancia_inscripcion?: string | null;
  constancia_inscripcion?: string | null;
  observaciones?: string | null;
  comentarios?: string | null;
  [campo: string]: unknown;
}

/**
 * Reporte de robo de un vehículo (`repuve.getTheftReport`).
 * Si no hay reporte, el resultado trae `found: false` y `data: null`.
 */
export interface RepuveTheftReport {
  /** `true` si el vehículo tiene reporte de robo vigente. */
  robado?: boolean;
  fecha_registro?: string | null;
  fecha_ultima_actualizacion?: string | null;
  placas?: string | null;
  numero_serie?: string | null;
  /** Fuente del reporte (por ejemplo `PGJ - JALISCO`). */
  fuente?: string | null;
  /** Número Único de Caso (carpeta de investigación). */
  nuc?: string | null;
  agente_mp?: string | null;
  [campo: string]: unknown;
}

/** Datos del propietario registrado de un vehículo (`repuve.getOwner`). */
export interface RepuveOwner {
  nombre_completo?: string | null;
  rfc?: string | null;
  curp?: string | null;
  fecha_nacimiento?: string | null;
  estado_civil?: string | null;
  genero?: string | null;
  pais_origen?: string | null;
  estado?: string | null;
  municipio?: string | null;
  calle?: string | null;
  colonia?: string | null;
  codigo_postal?: string | number | null;
  numero_exterior?: string | number | null;
  numero_interior?: string | number | null;
  [campo: string]: unknown;
}
