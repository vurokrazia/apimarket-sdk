import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig, validateBaseUrl, validatePath } from '../src/config.js';
import { ApiMarketClient, ApiMarketConfigError } from '../src/index.js';
import { jsonResponse, mockFetch, VEHICLE_OK } from './helpers.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveConfig', () => {
  it('lanza ApiMarketConfigError nombrando la variable si no hay token', () => {
    vi.stubEnv('APIMARKET_API_KEY', '');
    expect(() => resolveConfig()).toThrow(ApiMarketConfigError);
    expect(() => resolveConfig()).toThrow(/APIMARKET_API_KEY/);
  });

  it('usa la variable de entorno cuando no hay argumento', () => {
    vi.stubEnv('APIMARKET_API_KEY', 'env-token');
    expect(resolveConfig().apiKey).toBe('env-token');
  });

  it('el argumento del constructor tiene prioridad sobre el entorno', () => {
    vi.stubEnv('APIMARKET_API_KEY', 'env-token');
    expect(resolveConfig({ apiKey: 'client-token' }).apiKey).toBe('client-token');
  });

  it('la opción por llamada tiene prioridad sobre el constructor', () => {
    vi.stubEnv('APIMARKET_API_KEY', 'env-token');
    expect(resolveConfig({ apiKey: 'client-token' }, { apiKey: 'call-token' }).apiKey).toBe('call-token');
  });

  it('aplica valores por defecto', () => {
    vi.stubEnv('APIMARKET_API_KEY', 't');
    expect(resolveConfig()).toEqual({
      apiKey: 't',
      baseUrl: 'https://apimarket.mx',
      sandbox: false,
      timeoutMs: 30000,
      maxRetries: 0,
    });
  });

  it('lee sandbox, timeout, reintentos y baseUrl del entorno', () => {
    vi.stubEnv('APIMARKET_API_KEY', 't');
    vi.stubEnv('APIMARKET_SANDBOX', 'true');
    vi.stubEnv('APIMARKET_TIMEOUT_MS', '5000');
    vi.stubEnv('APIMARKET_MAX_RETRIES', '2');
    vi.stubEnv('APIMARKET_BASE_URL', 'https://staging.apimarket.mx/');
    expect(resolveConfig()).toMatchObject({
      sandbox: true,
      timeoutMs: 5000,
      maxRetries: 2,
      baseUrl: 'https://staging.apimarket.mx',
    });
  });

  it('rechaza valores inválidos en el entorno', () => {
    vi.stubEnv('APIMARKET_API_KEY', 't');
    vi.stubEnv('APIMARKET_SANDBOX', 'quizas');
    expect(() => resolveConfig()).toThrow(/APIMARKET_SANDBOX/);
    vi.stubEnv('APIMARKET_SANDBOX', 'false');
    vi.stubEnv('APIMARKET_TIMEOUT_MS', '-1');
    expect(() => resolveConfig()).toThrow(/APIMARKET_TIMEOUT_MS/);
  });

  it('limita los reintentos', () => {
    expect(() => resolveConfig({ apiKey: 't', maxRetries: 50 })).toThrow(ApiMarketConfigError);
  });
});

describe('validateBaseUrl', () => {
  it('acepta https y http://localhost', () => {
    expect(validateBaseUrl('https://apimarket.mx/')).toBe('https://apimarket.mx');
    expect(validateBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('rechaza http remoto, credenciales y query string', () => {
    expect(() => validateBaseUrl('http://apimarket.mx')).toThrow(ApiMarketConfigError);
    expect(() => validateBaseUrl('https://user:pass@apimarket.mx')).toThrow(ApiMarketConfigError);
    expect(() => validateBaseUrl('https://apimarket.mx?x=1')).toThrow(ApiMarketConfigError);
    expect(() => validateBaseUrl('no es url')).toThrow(ApiMarketConfigError);
  });
});

describe('validatePath', () => {
  it('acepta rutas /api/', () => {
    expect(validatePath('/api/v3/repuve/datos-vehiculo')).toBe('/api/v3/repuve/datos-vehiculo');
  });

  it.each([
    'https://evil.com/api/x',
    '//evil.com/api/x',
    '/api/../admin',
    '/otra/ruta',
    '/api/x?token=1',
    '/api/x#y',
    '/api\\x',
    'api/x',
    '/api/x y',
  ])('rechaza "%s"', (path) => {
    expect(() => validatePath(path)).toThrow(ApiMarketConfigError);
  });
});

describe('ApiMarketClient y entorno', () => {
  it('lee el token del entorno al momento de la llamada, no al construir', async () => {
    vi.stubEnv('APIMARKET_API_KEY', '');
    const { fetch, calls } = mockFetch(jsonResponse(VEHICLE_OK));
    const client = new ApiMarketClient({ fetch });

    await expect(client.repuve.getVehicle({ placas: 'ABC123' })).rejects.toThrow(ApiMarketConfigError);
    expect(fetch).not.toHaveBeenCalled();

    vi.stubEnv('APIMARKET_API_KEY', 'later-token');
    await client.repuve.getVehicle({ placas: 'ABC123' });
    expect(calls[0]!.headers.Authorization).toBe('Bearer later-token');
  });

  it('rechaza baseUrl inválida en el constructor', () => {
    expect(() => new ApiMarketClient({ baseUrl: 'http://apimarket.mx' })).toThrow(ApiMarketConfigError);
  });

  it('no incluye el token en los mensajes de error', async () => {
    const { fetch } = mockFetch(jsonResponse({ success: false, message: 'El token proporcionado no es valido.' }, 401));
    const client = new ApiMarketClient({ apiKey: 'super-secreto', fetch });
    const error = await client.repuve.getVehicle({ placas: 'ABC123' }).catch((e: unknown) => e);
    expect(JSON.stringify(error)).not.toContain('super-secreto');
    expect(String((error as Error).message)).not.toContain('super-secreto');
  });
});
