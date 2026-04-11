import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Serve ONNX runtime files from node_modules during dev.
// These need special handling because:
// 1. ONNX runtime uses dynamic import() for its .mjs WASM glue
// 2. Vite intercepts and breaks those imports if files are in public/
// 3. This middleware serves them raw, bypassing Vite's transform pipeline
function serveOnnxFiles(): Plugin {
  const fileMap: Record<string, { path: string; mime: string }> = {
    '/silero_vad_legacy.onnx': {
      path: 'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx',
      mime: 'application/octet-stream',
    },
    '/vad.worklet.bundle.min.js': {
      path: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
      mime: 'application/javascript',
    },
  };

  // Add all ONNX WASM and MJS files
  const onnxFiles = [
    'ort-wasm-simd-threaded.wasm',
    'ort-wasm-simd-threaded.asyncify.wasm',
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.mjs',
    'ort-wasm-simd-threaded.asyncify.mjs',
  ];
  for (const f of onnxFiles) {
    const ext = f.endsWith('.mjs') ? 'application/javascript' : 'application/wasm';
    fileMap[`/${f}`] = {
      path: `node_modules/onnxruntime-web/dist/${f}`,
      mime: ext,
    };
  }

  return {
    name: 'serve-onnx-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Strip query params (Vite adds ?import etc)
        const urlPath = req.url?.split('?')[0] ?? '';
        const entry = fileMap[urlPath];
        if (entry) {
          const absPath = resolve(process.cwd(), entry.path);
          if (existsSync(absPath)) {
            const data = readFileSync(absPath);
            res.setHeader('Content-Type', entry.mime);
            res.setHeader('Content-Length', data.length);
            res.end(data);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveOnnxFiles()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/sessions': 'http://localhost:8000',
    },
  },
});
