/**
 * Pruebas contra el sandbox real de ApiMarket (no consumen créditos).
 * Se omiten si no está definida la variable APIMARKET_API_KEY.
 *
 *   APIMARKET_API_KEY=... npm run test:integration
 */
import { describe, expect, it } from 'vitest';
import { ApiMarketClient } from '../../src/index.js';

const hasToken = Boolean(process.env.APIMARKET_API_KEY);

describe.skipIf(!hasToken)('sandbox de ApiMarket: REPUVE', () => {
  // Siempre en sandbox, aunque el entorno diga otra cosa.
  const client = new ApiMarketClient({ sandbox: true, timeoutMs: 60_000 });

  it('getVehicle responde con el sobre esperado', async () => {
    const result = await client.repuve.getVehicle({ placas: '775TWT' });
    expect(typeof result.found).toBe('boolean');
    expect(result.status).toBeGreaterThanOrEqual(200);
    console.log('[getVehicle]', JSON.stringify(result.raw, null, 2));
  });

  it('getTheftReport responde con el sobre esperado', async () => {
    const result = await client.repuve.getTheftReport({ numero_serie: '4A3AK44T36E024814' });
    expect(typeof result.found).toBe('boolean');
    console.log('[getTheftReport]', JSON.stringify(result.raw, null, 2));
  });

  it('getOwner responde con el sobre esperado', async () => {
    const result = await client.repuve.getOwner({ placas: '775TWT' });
    expect(typeof result.found).toBe('boolean');
    console.log('[getOwner]', JSON.stringify(result.raw, null, 2));
  });
});
