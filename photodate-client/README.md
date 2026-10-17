# PhotoDate client

See the [project README](../README.md) for shared capture, setup and deployment.

- npm run dev: development server with same-origin API/socket proxies.
- npm run build: TypeScript validation and production assets in dist.
- npm run lint: source lint with warnings treated as failures.
- npm run preview: static preview; backend features require an API/reverse proxy.

VITE_SERVER_URL is optional. Unset uses /api and the current origin socket endpoint. Separate hosting needs the public API HTTPS origin at build time and matching backend CORS configuration.
