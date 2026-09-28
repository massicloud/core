import { cpSync } from 'node:fs'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2020',
  treeshake: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    cpSync('src/templates', 'dist/templates', { recursive: true })
  },
})
