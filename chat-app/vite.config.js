import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from "node:url" // <-- Change this import

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server:{
    allowedHosts:true,
  },
  resolve:{
    alias:{
      // <-- Use this bulletproof ESM method
      "@": fileURLToPath(new URL("./src", import.meta.url)), 
    }
  },
})