import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
   server: {
    host: true, // Listen on all addresses, including LAN and public addresses
    port: 5173, // Optional: specify a port
  },
  plugins: [react()],
});
