import { defineConfig } from 'vitest/config'

// Config separada: estes testes falam com o emulador do Firestore e precisam de
// Java, então não entram no `npm test` do dia a dia nem no include padrão.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['firestore.rules.test.js'],
    // Subir o emulador e semear dados é mais lento que um teste puro.
    testTimeout: 20000,
    hookTimeout: 30000,
    // As regras têm estado compartilhado (clearFirestore entre casos), então
    // rodar arquivos em paralelo daria corrida.
    fileParallelism: false,
  },
})
