import { describe, expect, it } from 'vitest';
import { ApiMarketClient, ApiMarketValidationError } from '../src/index.js';
import { jsonResponse, mockFetch, NO_THEFT, NOT_REGISTERED, VEHICLE_OK } from './helpers.js';

function setup(...responses: Response[]) {
  const mock = mockFetch(...responses);
  const client = new ApiMarketClient({ apiKey: 'test-token', fetch: mock.fetch });
  return { client, ...mock };
}

describe('repuve.getVehicle', () => {
  it('envía POST con cuerpo JSON, headers y devuelve los datos', async () => {
    const { client, calls } = setup(
      jsonResponse(VEHICLE_OK, 200, { 'X-RateLimit-Limit': '5', 'X-RateLimit-Remaining': '3' }),
    );
    const result = await client.repuve.getVehicle({ placas: ' abc-123 ' });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.init.method).toBe('POST');
    expect(call.url.toString()).toBe('https://apimarket.mx/api/repuve/grupo/datos-vehiculo');
    expect(call.body).toEqual({ placas: 'ABC123' });
    expect(call.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });
    expect(call.headers['x-sandbox']).toBeUndefined();

    expect(result.found).toBe(true);
    expect(result.data?.marca).toBe('FORD TRUCKS');
    expect(result.codigoValidacion).toBe('abc123');
    expect(result.rateLimit).toEqual({ limit: 5, remaining: 3 });
    expect(result.raw).toEqual(VEHICLE_OK);
  });

  it('normaliza "no inscrito" a found: false', async () => {
    const { client } = setup(jsonResponse(NOT_REGISTERED));
    const result = await client.repuve.getVehicle({ placas: 'BMT789A' });
    expect(result.found).toBe(false);
    expect(result.data).toBeNull();
    expect(result.message).toMatch(/no se encuentra inscrito/);
  });

  it('trata HTTP 404 con success: true como "sin datos"', async () => {
    const { client } = setup(
      jsonResponse({ success: true, codigoValidacion: 'x', message: 'No se encontraron datos.', status: 200 }, 404),
    );
    const result = await client.repuve.getVehicle({ placas: 'ABC123' });
    expect(result.found).toBe(false);
    expect(result.status).toBe(404);
  });

  it('envía x-sandbox cuando se pide por llamada', async () => {
    const { client, calls } = setup(jsonResponse(VEHICLE_OK));
    await client.repuve.getVehicle({ placas: 'ABC123' }, { sandbox: true });
    expect(calls[0]!.headers['x-sandbox']).toBe('true');
  });
});

describe('repuve.getTheftReport', () => {
  it('usa la ruta de robo y acepta numero_serie', async () => {
    const { client, calls } = setup(
      jsonResponse({ ...VEHICLE_OK, data: { robado: true, fuente: 'PGJ - JALISCO', nuc: '61844/17CI' } }),
    );
    const result = await client.repuve.getTheftReport({ numero_serie: '4a3ak44t36e024814' });
    expect(calls[0]!.url.pathname).toBe('/api/repuve/grupo/consulta-robo');
    expect(calls[0]!.body).toEqual({ numero_serie: '4A3AK44T36E024814' });
    expect(result.found).toBe(true);
    expect(result.data?.robado).toBe(true);
  });

  it('sin reporte de robo devuelve found: false', async () => {
    const { client } = setup(jsonResponse(NO_THEFT));
    const result = await client.repuve.getTheftReport({ placas: 'ABC123' });
    expect(result.found).toBe(false);
    expect(result.data).toBeNull();
  });
});

describe('repuve.getOwner', () => {
  it('usa la ruta de propietario', async () => {
    const { client, calls } = setup(
      jsonResponse({ ...VEHICLE_OK, data: { nombre_completo: 'XXX YYY', rfc: 'XAXX010101000' } }),
    );
    const result = await client.repuve.getOwner({ placas: 'ABC123', numero_serie: '4A3AK44T36E024814' });
    expect(calls[0]!.url.pathname).toBe('/api/repuve/grupo/consulta-propietario');
    expect(calls[0]!.body).toEqual({ placas: 'ABC123', numero_serie: '4A3AK44T36E024814' });
    expect(result.data?.nombre_completo).toBe('XXX YYY');
  });
});

describe('validación local', () => {
  it.each([
    [{}, /al menos/],
    [{ placas: '' }, /al menos/],
    [{ placas: 'ABCDEFGHIJK' }, /placas/],
    [{ placas: 'ÑÑÑ' }, /placas/],
    [{ numero_serie: '123' }, /numero_serie/],
    [{ numero_serie: '4A3AK44T36E02481O' }, /numero_serie/],
  ])('rechaza %j sin llamar a la API', async (params, message) => {
    const { client, fetch } = setup(jsonResponse(VEHICLE_OK));
    await expect(client.repuve.getVehicle(params)).rejects.toThrow(ApiMarketValidationError);
    await expect(client.repuve.getVehicle(params)).rejects.toThrow(message);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('skipFormatValidation permite NIV no estándar', async () => {
    const { client, calls } = setup(jsonResponse(VEHICLE_OK));
    await client.repuve.getVehicle({ numero_serie: 'abc123' }, { skipFormatValidation: true });
    expect(calls[0]!.body).toEqual({ numero_serie: 'ABC123' });
  });
});
