import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/verifier',
  plugins: [react()],
  optimizeDeps: {
    exclude: [
      '@noble/hashes/sha256',
      '@noble/hashes/utils',
      '@noble/hashes/hmac',
      '@noble/curves/bls12-381',
    ],
  },
});
