import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => funciona en cualquier ruta (p. ej. usuario.github.io/nombre-repo/)
export default defineConfig({ base: './', plugins: [react()] });
