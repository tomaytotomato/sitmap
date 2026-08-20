import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // Served from https://tomaytotomato.github.io/sitmap/ via GitHub Pages —
  // asset URLs need the repo name as a base path, unlike a custom domain.
  base: '/sitmap/',
  plugins: [vue()],
})
