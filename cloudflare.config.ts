import { bindings, defineConfig, exports } from 'cf/config';
import * as entrypoint from './src/worker.js' with { type: 'cf-worker' };
export default defineConfig({
  worker: {
    name: 'coup-friends', entrypoint, compatibilityDate: '2026-11-21',
    assets: { runWorkerFirst: ['/api'] },
    env: { ASSETS: bindings.assets(), ROOMS: bindings.durableObject({ worker: 'coup-friends', exportName: 'Room' }) },
    exports: { Room: exports.durableObject({ storage: 'sqlite' }) },
    observability: { enabled: true, traces: { enabled: true } },
  },
});
