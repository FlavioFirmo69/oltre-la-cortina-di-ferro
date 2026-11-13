import {defineConfig} from 'vite';
// Keep dev usable in restricted Windows workspaces without an esbuild scan of ancestors.
export default defineConfig({optimizeDeps:{noDiscovery:true,include:[]}});
