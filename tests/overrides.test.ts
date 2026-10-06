import { describe, expect, it } from 'vitest';
import { ApiMarketClient, ApiMarketConfigError, ENDPOINTS } from '../src/index.js';
import { jsonResponse, mockFetch, VEHICLE_OK } from './helpers.js';

describe('overrides de endpoints', () => {
  it('el cliente puede apuntar un endpoint a otra versión y transporte', async () => {
    const { fetch, calls } = mockFetch(jsonResponse(VEHICLE_OK));
    const client = new ApiMarketClient({
      apiKey: 't',
      fetch,
      endpoints: {
        'repuve.getVehicle': { path: '/api/v3/repuve/datos-vehiculo', transport: 'query', version: 'v3' },
      },
    });

    expect(client.getEndpoint('repuve.getVehicle')).toMatchObject({
      path: '/api/v3/repuve/datos-vehiculo',
      transport: 'query',
      version: 'v3',
    });

    await client.repuve.getVehicle({ placas: 'ABC123' });
    expect(calls[0]!.url.pathname).toBe('/api/v3/repuve/datos-vehiculo');
    expect(calls[0]!.url.searchParams.get('placas')).toBe('ABC123');
    expect(calls[0]!.body).toBeUndefined();
    expect(calls[0]!.headers['Content-Type']).toBeUndefined();
  });

  it('el override por llamada gana al del cliente', async () => {
    const { fetch, calls } = mockFetch(jsonResponse(VEHICLE_OK));
    const client = new ApiMarketClient({
      apiKey: 't',
      fetch,
      endpoints: { 'repuve.getOwner': { path: '/api/v2/repuve/propietario' } },
    });
    await client.repuve.getOwner({ placas: 'ABC123' }, { path: '/api/v4/repuve/propietario' });
    expect(calls[0]!.url.pathname).toBe('/api/v4/repuve/propietario');
  });

  it('no modifica el registro global', () => {
    new ApiMarketClient({ endpoints: { 'repuve.getVehicle': { path: '/api/otra' } } });
    expect(ENDPOINTS['repuve.getVehicle'].path).toBe('/api/repuve/grupo/datos-vehiculo');
  });

  it('rechaza ids desconocidos', () => {
    expect(
      () => new ApiMarketClient({ endpoints: { 'repuve.noExiste': { path: '/api/x' } } as never }),
    ).toThrow(/Endpoint desconocido/);
  });

  it('rechaza rutas a otro host o fuera de /api/', async () => {
    expect(
      () => new ApiMarketClient({ endpoints: { 'repuve.getVehicle': { path: 'https://evil.com/api/x' } } }),
    ).toThrow(ApiMarketConfigError);

    const { fetch } = mockFetch(jsonResponse(VEHICLE_OK));
    const client = new ApiMarketClient({ apiKey: 't', fetch });
    await expect(client.repuve.getVehicle({ placas: 'ABC123' }, { path: '//evil.com/api/x' })).rejects.toThrow(
      ApiMarketConfigError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza métodos y transportes no permitidos', () => {
    expect(
      () => new ApiMarketClient({ endpoints: { 'repuve.getVehicle': { method: 'TRACE' as never } } }),
    ).toThrow(/Método/);
    expect(
      () => new ApiMarketClient({ endpoints: { 'repuve.getVehicle': { transport: 'xml' as never } } }),
    ).toThrow(/Transporte/);
  });

  it('no permite sobreescribir Authorization con headers extra', async () => {
    const { fetch, calls } = mockFetch(jsonResponse(VEHICLE_OK));
    const client = new ApiMarketClient({ apiKey: 'real', fetch });
    await client.repuve.getVehicle(
      { placas: 'ABC123' },
      { headers: { authorization: 'Bearer otro', 'X-Request-Id': 'r1' } },
    );
    expect(calls[0]!.headers.Authorization).toBe('Bearer real');
    expect(calls[0]!.headers.authorization).toBeUndefined();
    expect(calls[0]!.headers['X-Request-Id']).toBe('r1');
  });
});

describe('client.request', () => {
  it('llama endpoints no envueltos con la misma autenticación', async () => {
    const { fetch, calls } = mockFetch(jsonResponse({ balance: 120 }));
    const client = new ApiMarketClient({ apiKey: 't', fetch });
    const result = await client.request<{ balance: number }>({ method: 'GET', path: '/api/balance' });
    expect(calls[0]!.init.method).toBe('GET');
    expect(calls[0]!.headers.Authorization).toBe('Bearer t');
    expect(result.found).toBe(true);
    expect(result.data).toEqual({ balance: 120 });
  });

  it('aplica los mismos límites de ruta', () => {
    const client = new ApiMarketClient({ apiKey: 't' });
    expect(() => client.request({ method: 'GET', path: 'https://evil.com/api/x' })).toThrow(ApiMarketConfigError);
  });
});
