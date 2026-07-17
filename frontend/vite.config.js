import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'api-cache-server',
      configureServer(server) {
        server.middlewares.use('/api_cache', (req, res, next) => {
          // req.url is something like '/stock.json'
          const filePath = path.resolve(__dirname, '../api_cache', req.url.split('?')[0].replace(/^\//, ''));
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(fs.readFileSync(filePath));
          } else {
            next();
          }
        });
      }
    },
    react(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/api_cache/**']
    }
  }
})
