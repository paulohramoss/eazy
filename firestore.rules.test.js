// Testes das regras do Firestore contra o emulador.
//
// As regras são a única barreira entre os dados financeiros de um usuário e
// qualquer outro: revisá-las lendo não basta. Rodar exige o emulador, que exige
// Java — por isso o arquivo fica fora do `npm test` padrão e tem script próprio.
//
//   npm run test:rules
import { readFileSync } from 'node:fs'
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  query, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const ALICE = 'alice'
const BOB = 'bob'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'eazy-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => { await testEnv?.cleanup() })
beforeEach(async () => { await testEnv.clearFirestore() })

const db = (uid) => testEnv.authenticatedContext(uid).firestore()
const anonDb = () => testEnv.unauthenticatedContext().firestore()

const owned = (uid, extra) => ({ userId: uid, allowedUsers: [uid], ...extra })

const TX = { name: 'Mercado', amount: 99.9, type: 'expense', category: 'Alimentação', date: '2026-03-10', status: 'completed' }

// Semeia um documento contornando as regras, para testar leitura/edição.
const seed = (col, id, data) =>
  testEnv.withSecurityRulesDisabled(ctx => setDoc(doc(ctx.firestore(), col, id), data))

// ─── Isolamento entre usuários ───────────────────────────────────────────────

describe('isolamento entre contas', () => {
  it('anônimo não lê nem escreve', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(getDoc(doc(anonDb(), 'transactions/t1')))
    await assertFails(addDoc(collection(anonDb(), 'transactions'), owned(ALICE, TX)))
  })

  it('Bob não lê a transação da Alice', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(getDoc(doc(db(BOB), 'transactions/t1')))
  })

  it('Bob não edita nem apaga a transação da Alice', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(updateDoc(doc(db(BOB), 'transactions/t1'), { amount: 1 }))
    await assertFails(deleteDoc(doc(db(BOB), 'transactions/t1')))
  })

  it('Alice lê a própria transação', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertSucceeds(getDoc(doc(db(ALICE), 'transactions/t1')))
  })

  it('a query por allowedUsers funciona (regressão do permission-denied)', async () => {
    // O `is list` de isMember() não é dedutível da query, então o solver
    // negava a listagem inteira. Por isso list tem regra própria.
    await seed('transactions', 't1', owned(ALICE, TX))
    const q = query(collection(db(ALICE), 'transactions'), where('allowedUsers', 'array-contains', ALICE))
    const snap = await assertSucceeds(getDocs(q))
    expect(snap.size).toBe(1)
  })

  it('não dá para listar tudo sem o filtro', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(getDocs(collection(db(BOB), 'transactions')))
  })

  it('preferências são privadas', async () => {
    await seed('users', ALICE, { prefs: { currency: 'BRL' } })
    await assertSucceeds(getDoc(doc(db(ALICE), 'users', ALICE)))
    await assertFails(getDoc(doc(db(BOB), 'users', ALICE)))
  })

  it('coleção fora da lista é inacessível', async () => {
    await assertFails(getDoc(doc(db(ALICE), 'qualquerOutra/x')))
    await assertFails(addDoc(collection(db(ALICE), 'qualquerOutra'), owned(ALICE, {})))
  })
})

// ─── Propriedade do documento ────────────────────────────────────────────────

describe('propriedade', () => {
  it('cria documento próprio', async () => {
    await assertSucceeds(addDoc(collection(db(ALICE), 'transactions'), owned(ALICE, TX)))
  })

  it('não cria em nome de outro', async () => {
    await assertFails(addDoc(collection(db(ALICE), 'transactions'),
      { userId: BOB, allowedUsers: [BOB], ...TX }))
  })

  it('não cria já compartilhando com terceiro', async () => {
    // Compartilhamento não existe na UI; liberar allowedUsers na criação
    // abriria caminho para gravar na conta alheia.
    await assertFails(addDoc(collection(db(ALICE), 'transactions'),
      { userId: ALICE, allowedUsers: [ALICE, BOB], ...TX }))
  })

  it('não cria documento órfão', async () => {
    await assertFails(addDoc(collection(db(ALICE), 'transactions'), TX))
  })

  it('não muda o dono depois de criado', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(updateDoc(doc(db(ALICE), 'transactions/t1'), { userId: BOB }))
  })

  it('não adiciona terceiro em allowedUsers via update', async () => {
    // Sem isto, um membro reescrevia a lista e vazava o documento.
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(updateDoc(doc(db(ALICE), 'transactions/t1'), { allowedUsers: [ALICE, BOB] }))
  })
})

// ─── Validação de conteúdo ───────────────────────────────────────────────────

describe('validação de transações', () => {
  const create = (data) => addDoc(collection(db(ALICE), 'transactions'), owned(ALICE, data))

  it('aceita uma transação bem formada', async () => {
    await assertSucceeds(create(TX))
  })

  it('rejeita valor em texto', async () => {
    await assertFails(create({ ...TX, amount: 'banana' }))
  })

  it('rejeita valor negativo', async () => {
    // O tipo (income/expense) é quem diz a direção.
    await assertFails(create({ ...TX, amount: -50 }))
  })

  it('rejeita valor absurdo', async () => {
    await assertFails(create({ ...TX, amount: 1e15 }))
  })

  it('rejeita data fora do formato ISO', async () => {
    await assertFails(create({ ...TX, date: '10/03/2026' }))
    await assertFails(create({ ...TX, date: 'ontem' }))
  })

  it('exige valor e data', async () => {
    await assertFails(create({ name: 'x', type: 'expense', date: '2026-03-10' }))
    await assertFails(create({ name: 'x', type: 'expense', amount: 10 }))
  })

  it('rejeita tipo desconhecido', async () => {
    await assertFails(create({ ...TX, type: 'transferencia' }))
  })

  it('rejeita status desconhecido', async () => {
    await assertFails(create({ ...TX, status: 'talvez' }))
  })

  it('aceita os três status válidos', async () => {
    for (const status of ['completed', 'pending', 'failed']) {
      await assertSucceeds(create({ ...TX, status }))
    }
  })

  it('rejeita string gigante', async () => {
    // Sem teto, um documento de megabytes derrubaria a leitura de toda a lista.
    await assertFails(create({ ...TX, name: 'a'.repeat(5000) }))
    await assertFails(create({ ...TX, notes: 'a'.repeat(5000) }))
  })

  it('aceita campos opcionais ausentes', async () => {
    await assertSucceeds(create({ amount: 10, date: '2026-03-10', type: 'income' }))
  })

  it('valida também no update', async () => {
    await seed('transactions', 't1', owned(ALICE, TX))
    await assertFails(updateDoc(doc(db(ALICE), 'transactions/t1'), { amount: 'banana' }))
    await assertSucceeds(updateDoc(doc(db(ALICE), 'transactions/t1'), { amount: 12.5 }))
  })

  it('permite a conclusão automática de pendentes', async () => {
    await seed('transactions', 't1', owned(ALICE, { ...TX, status: 'pending' }))
    await assertSucceeds(updateDoc(doc(db(ALICE), 'transactions/t1'), { status: 'completed' }))
  })
})

// ─── Formatos que o app realmente grava ──────────────────────────────────────
// Esta seção existe para pegar a divergência entre o que o app manda e o que a
// regra aceita — que é o modo mais provável de as regras quebrarem a produção.

describe('formatos reais do app', () => {
  const create = (col, data) => addDoc(collection(db(ALICE), col), owned(ALICE, data))

  it('carteira do onboarding', async () => {
    await assertSucceeds(create('wallets',
      { name: 'Conta corrente', type: 'checking', balance: 0, color: '#0053EF', icon: 'fi-rr-bank' }))
  })

  it('carteira com saldo em texto é rejeitada', async () => {
    await assertFails(create('wallets', { name: 'X', type: 'checking', balance: '100' }))
  })

  it('cartão de crédito com dias inteiros', async () => {
    await assertSucceeds(create('creditCards',
      { name: 'Nubank', flag: 'Visa', limit: 5000, closingDay: 10, dueDay: 17, color: '#1a1a2e' }))
  })

  it('cartão com dia fora da faixa é rejeitado', async () => {
    await assertFails(create('creditCards', { name: 'X', limit: 100, closingDay: 32 }))
    await assertFails(create('creditCards', { name: 'X', limit: 100, dueDay: 0 }))
  })

  it('objetivo com prazo vazio', async () => {
    // O formulário inicia deadline como string vazia.
    await assertSucceeds(create('goals', { name: 'Viagem', target: 5000, current: 0, deadline: '' }))
  })

  it('objetivo com prazo em ISO', async () => {
    await assertSucceeds(create('goals', { name: 'Viagem', target: 5000, current: 0, deadline: '2026-12-31' }))
  })

  it('orçamento', async () => {
    await assertSucceeds(create('budgets', { category: 'Alimentação', limit: 800 }))
  })

  it('investimento usa avgPrice', async () => {
    await assertSucceeds(create('investments',
      { name: 'Petrobras', ticker: 'PETR4', type: 'Ação', quantity: 100, avgPrice: 38.5, currentPrice: 40.1, color: '#0053EF' }))
  })

  it('recorrência criada pela série', async () => {
    await assertSucceeds(create('recurrences', {
      name: 'Aluguel', amount: 2500, type: 'expense', category: 'Moradia',
      walletId: 'w1', cardId: '', notes: '', frequency: 'monthly',
      startDate: '2026-03-05', endDate: '', nextDate: '2026-04-05', active: true,
    }))
  })

  it('recorrência com frequência inválida é rejeitada', async () => {
    await assertFails(create('recurrences', {
      name: 'X', amount: 10, type: 'expense', frequency: 'diaria',
      startDate: '2026-03-05', nextDate: '2026-04-05',
    }))
  })

  it('transação gerada por recorrência carrega recurrenceId', async () => {
    await assertSucceeds(create('transactions', { ...TX, recurrenceId: 'r1', walletId: 'w1', cardId: '' }))
  })

  it('aporte em objetivo', async () => {
    await assertSucceeds(create('transactions', {
      name: 'Aporte: Viagem', amount: 200, type: 'expense', category: 'Objetivos',
      walletId: 'w1', goalId: 'g1', date: '2026-03-10', status: 'completed',
    }))
  })
})
