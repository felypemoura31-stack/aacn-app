import { defineConfig } from 'vitest/config'

// Testes das funções puras do app (dinheiro, datas, sorteio). As regras do banco têm o próprio teste: npm run test:regras.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
