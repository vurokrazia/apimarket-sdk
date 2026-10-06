/**
 * Ejemplo: consulta completa de un vehículo en REPUVE.
 *
 *   APIMARKET_API_KEY=tu-token APIMARKET_SANDBOX=true npm run example -- ABC1234
 *
 * Con APIMARKET_SANDBOX=true no se consumen créditos.
 */
import { ApiMarketClient, ApiMarketError, isValidVin } from '../src/index.js';

async function main() {
  const identificador = process.argv[2] ?? '775TWT';
  const params = isValidVin(identificador) ? { numero_serie: identificador } : { placas: identificador };

  const client = new ApiMarketClient();

  const vehiculo = await client.repuve.getVehicle(params);
  if (!vehiculo.found) {
    console.log(`Sin datos: ${vehiculo.message}`);
    return;
  }
  console.log('Vehículo:', vehiculo.data);

  const robo = await client.repuve.getTheftReport(params);
  console.log(robo.found ? `⚠️  Reporte de robo: ${robo.data?.fuente} (${robo.data?.nuc})` : '✅ Sin reporte de robo');

  console.log('Folio ApiMarket:', vehiculo.codigoValidacion, '· Rate limit:', vehiculo.rateLimit);
}

main().catch((error: unknown) => {
  if (error instanceof ApiMarketError) {
    console.error(`[${error.name}] ${error.message}`, { status: error.status, folio: error.codigoValidacion });
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
