import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage']),

  // ── App (browser) ──────────────────────────────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ignoreRestSiblings existe para o padrão `const { a, ...resto } = obj`,
      // usado no app para OMITIR campos (ex.: tirar id/userId antes de exportar).
      // Sem ele o lint acusava de "não usado" justamente o que era descartado
      // de propósito.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // O tradutor se chama `t` e é usado em quase todo componente. Um
      // `.map(t => ...)` sombreando esse nome compila e passa no build, mas
      // quebra em runtime assim que alguém adicionar um t('chave') dentro do
      // callback — e o erro aparece só naquela tela. Proibir o sombreamento
      // torna a colisão impossível em vez de improvável.
      'no-shadow': 'error',
    },
  },

  // Contextos exportam o provider e os hooks/constantes que o acompanham.
  // Separar isso em outro arquivo só para agradar o Fast Refresh pioraria a
  // legibilidade; o custo real é um full reload ocasional em dev.
  {
    files: ['src/context/**/*.jsx', 'src/components/Toast.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // ── Funções serverless e config (Node) ────────────────────────────────────
  {
    files: ['api/**/*.js', 'scripts/**/*.js', '*.config.js', 'firestore.rules.test.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node },
      parserOptions: { sourceType: 'module' },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },

  // ── Service worker ────────────────────────────────────────────────────────
  {
    files: ['public/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.serviceworker, ...globals.browser, firebase: 'readonly' },
      parserOptions: { sourceType: 'script' },
    },
  },

  // ── Testes ────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
