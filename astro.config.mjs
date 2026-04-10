import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  server: {
    host: true,
    port: 4323,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:4324',
      },
    },
  },
});
