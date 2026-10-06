import { describe, expect, it, vi } from 'vitest';
import {
  ApiMarketAuthError,
  ApiMarketClient,
  ApiMarketNetworkError,
  ApiMarketNotFoundError,
  ApiMarketRateLimitError,
  ApiMarketResponseError,
  ApiMarketServerError,
  ApiMarketTimeoutError,
  ApiMarketValidationError,
} from '../src/index.js';
import { jsonResponse, mockFetch, VEHICLE_OK } from './helpers.js';

function client(fetch: ReturnType<typeof mockFetch>['fetch'], extra = {}) {
  return new ApiMarketClient({ apiKey: 't', fetch, ...extra });
}

describe('mapeo de errores', () => {
  it.each([
    [400, ApiMarketValidationError],
    [422, ApiMarketValidationError],
    [401, ApiMarketAuthError],
    [403, ApiMarketAuthError],
    [404, ApiMarketNotFoundError],
    [429, ApiMarketRateLimitError],
    [500, ApiMarketServerError],
    [503, ApiMarketServerError],
    [418, ApiMarketResponseError],
  ])('HTTP %i → %o', async (status, ErrorClass) => {
    const { fetch } = mockFetch(
      jsonResponse({ success: false, codigoValidacion: 'cv1', message: 'falló', status }, status),
    );
    const error = await client(fetch).repuve.getVehicle({ placas: 'ABC123' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ status, codigoValidacion: 'cv1', endpoint: 'repuve.getVehicle', message: 'falló' });
  });

  it('429 expone retryAfter', async () => {
    const { fetch } = mockFetch(jsonResponse({ success: false }, 429, { 'Retry-After': '7' }));
    const error = await client(fetch).repuve.getVehicle({ placas: 'ABC123' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiMarketRateLimitError);
    expect((error as ApiMarketRateLimitError).retryAfter).toBe(7);
  });

  it('HTTP 200 con success: false usa el status interno', async () => {
    const { fetch } = mockFetch(jsonResponse({ success: false, message: 'Token inválido', status: 401 }));
    await expect(client(fetch).repuve.getVehicle({ placas: 'ABC123' })).rejects.toBeInstanceOf(ApiMarketAuthError);
  });

  it('respuesta no JSON → ApiMarketResponseError', async () => {
    const { fetch } = mockFetch(new Response('<html>mantenimiento</html>', { status: 200 }));
    await expect(client(fetch).repuve.getVehicle({ placas: 'ABC123' })).rejects.toBeInstanceOf(
      ApiMarketResponseError,
    );
  });

  it('error de red → ApiMarketNetworkError', async () => {
    const { fetch } = mockFetch(new TypeError('fetch failed'));
    await expect(client(fetch).repuve.getVehicle({ placas: 'ABC123' })).rejects.toBeInstanceOf(
      ApiMarketNetworkError,
    );
  });
});

describe('timeout y cancelación', () => {
  const hangingFetch = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );

  it('lanza ApiMarketTimeoutError al exceder timeoutMs', async () => {
    const c = new ApiMarketClient({ apiKey: 't', fetch: hangingFetch, timeoutMs: 20 });
    await expect(c.repuve.getVehicle({ placas: 'ABC123' })).rejects.toBeInstanceOf(ApiMarketTimeoutError);
  });

  it('respeta la señal del usuario', async () => {
    const c = new ApiMarketClient({ apiKey: 't', fetch: hangingFetch });
    const controller = new AbortController();
    const promise = c.repuve.getVehicle({ placas: 'ABC123' }, { signal: controller.signal });
    controller.abort(new Error('cancelado por el usuario'));
    await expect(promise).rejects.toThrow('cancelado por el usuario');
  });
});

describe('reintentos', () => {
  it('no reintenta por defecto', async () => {
    const { fetch } = mockFetch(jsonResponse({ success: false }, 500), jsonResponse(VEHICLE_OK));
    await expect(client(fetch).repuve.getVehicle({ placas: 'ABC123' })).rejects.toBeInstanceOf(
      ApiMarketServerError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reintenta 5xx cuando maxRetries > 0', async () => {
    vi.useFakeTimers();
    try {
      const { fetch } = mockFetch(jsonResponse({ success: false }, 503), jsonResponse(VEHICLE_OK));
      const promise = client(fetch, { maxRetries: 2 }).repuve.getVehicle({ placas: 'ABC123' });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.found).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('no reintenta errores 4xx', async () => {
    const { fetch } = mockFetch(jsonResponse({ success: false }, 401), jsonResponse(VEHICLE_OK));
    await expect(client(fetch, { maxRetries: 3 }).repuve.getVehicle({ placas: 'ABC123' })).rejects.toBeInstanceOf(
      ApiMarketAuthError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
