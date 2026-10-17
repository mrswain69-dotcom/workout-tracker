import { prepareNativeArtwork } from './scripts/nativeArtwork.js'
import { validateNativeEnvironment } from './scripts/nativeBuildConfig.js'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async ({ mode }) => {
  const native = mode === 'native';
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  if (native) validateNativeEnvironment(env);
  const shellOnly = native && env.NATIVE_SHELL_ONLY === '1';
  const artwork = native ? await prepareNativeArtwork(process.cwd()) : null;
  return {
  // Shell smoke builds must never inherit a production API from .env.local.
  publicDir: artwork?.publicDir || 'public',
  define: {
    __NATIVE_ARTWORK__: JSON.stringify(artwork?.mapping || {}),
    ...(shellOnly ? {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
  } : {}),
  },
  plugins: [react()],
  build: {
    outDir: native ? "dist-native" : "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
if (!id.includes('/node_modules/')) return undefined
if (id.includes('/node_modules/recharts/')) return 'charts-recharts'
if (
  id.includes('/node_modules/d3-') ||
  id.includes('/node_modules/internmap/') ||
  id.includes('/node_modules/delaunator/') ||
  id.includes('/node_modules/robust-predicates/')
) return 'charts-d3'
if (
  id.includes('/node_modules/react/') ||
  id.includes('/node_modules/react-dom/') ||
  id.includes('/node_modules/scheduler/')
) return 'react-vendor'
if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor'
return 'vendor'
        },
      },
    },
  },
  };
})
