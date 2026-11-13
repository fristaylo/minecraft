import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');
const src = path.resolve(dir, 'src');

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, root, '').API_URL;
  if (!apiUrl) {
    throw new Error('API_URL is not set: define it in the environment or in the root .env (see .env.example in the repo root)');
  }
  return {
    plugins: [react()],
    envDir: root,
    clearScreen: false,
    server: { port: 1420, strictPort: true },
    define: { __API_HOST__: JSON.stringify(new URL(apiUrl).hostname) },
    resolve: {
      alias: {
        '@': src,
        '@components': path.join(src, 'components'),
        '@pages': path.join(src, 'pages'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: (content: string, filename: string) =>
            filename.replaceAll('\\', '/').endsWith('src/mixins.scss')
              ? content
              : `@use "mixins" as *;\n${content}`,
          loadPaths: [src],
        },
      },
    },
  };
});
