import { vi } from 'vitest';

export interface CapturedCall {
  url: URL;
  init: RequestInit;
  headers: Record<string, string>;
  body: unknown;
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** Crea un fetch simulado que responde en orden con las respuestas dadas y guarda las llamadas. */
export function mockFetch(...responses: Array<Response | (() => Response | Promise<Response>) | Error>) {
  const calls: CapturedCall[] = [];
  let index = 0;
  const fn = vi.fn(async (input: string, init: RequestInit) => {
    calls.push({
      url: new URL(input),
      init,
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next!.clone();
  });
  return { fetch: fn, calls };
}

export const VEHICLE_OK = {
  success: true,
  codigoValidacion: 'abc123',
  message: 'Exito',
  status: 200,
  data: {
    fecha_registro: '02/03/2019',
    numero_serie: '1FMCU0G98DUC76815',
    placa: 'A58NYE2',
    anio: '2013',
    marca: 'FORD TRUCKS',
    modelo: 'ESCAPE',
    estado_vehiculo: 'ACTIVO',
  },
};

export const NOT_REGISTERED = {
  success: true,
  codigoValidacion: 'nodata1',
  message: 'El vehículo con identificador: BMT789A no se encuentra inscrito en el Registro Público Vehicular.',
  status: 200,
  data: { ayuda: 'Para mayor información ...' },
};

export const NO_THEFT = {
  success: true,
  codigoValidacion: 'nodata2',
  message: 'El vehículo con identificador: X no tiene reporte de robo en el Registro Público Vehicular.',
  status: 200,
  data: [],
};
