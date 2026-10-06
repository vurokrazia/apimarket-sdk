# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

## [0.1.0] - 2026-10-06

### Agregado

- `ApiMarketClient` con autenticación Bearer y configuración por argumentos o variables de entorno
  (`APIMARKET_API_KEY`, `APIMARKET_BASE_URL`, `APIMARKET_SANDBOX`, `APIMARKET_TIMEOUT_MS`, `APIMARKET_MAX_RETRIES`).
- Módulo REPUVE: `getVehicle`, `getTheftReport` y `getOwner`.
- Validación local de placas y NIV, y los helpers `isValidPlate`, `isValidVin`, `normalizePlate` y `normalizeVin`.
- Respuesta normalizada `ApiMarketResult<T>`, con `found` para las respuestas "sin datos".
- Errores tipados (`ApiMarketError` y sus subclases).
- Sandbox, timeout, reintentos opcionales y cancelación con `AbortSignal`.
- Overrides de endpoints (ruta, método, transporte y versión), con límites de seguridad.
- `client.request()` para llamar endpoints que todavía no están envueltos.
