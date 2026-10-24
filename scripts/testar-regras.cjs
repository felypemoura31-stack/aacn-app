// Testa as regras do Firestore (firestore.rules) contra a API de teste de regras do Firebase, caso a caso.
//
//   node scripts/testar-regras.cjs            roda todos os casos
//   RULES=outro.rules node scripts/testar-regras.cjs     testa outro arquivo de regras (ex.: para ver se um teste "pega" uma falha)
//
// Precisa do firebase-tools instalado globalmente e de `firebase login` feito (usa o token dele). Não grava nada no banco:
// a API só simula cada requisição contra o texto das regras.
//
// Como ler um caso:  t(nome, 'ALLOW' | 'DENY', uid, método, caminho, dadosNovos, dadosAtuais, mocks)
//   - mocks simulam get()/exists()/getAfter()/existsAfter() das regras (o que existe no banco antes e depois do lote).
//   - "ts(...)" é igual a t(...), mas roda nas regras REAIS: a API de teste não representa datas, então nos casos comuns
//     os campos de hora do servidor (criadoEm, confirmadoEm...) são tratados como "ausente = ok", e os casos "ts" conferem
//     que, de verdade, a hora do servidor é exigida.
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const G = path.join(execSync('npm root -g').toString().trim(), 'firebase-tools')
const auth = require(path.join(G, 'lib', 'auth'))
const cfg = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE || process.env.HOME, '.config/configstore/firebase-tools.json'), 'utf8'))
const DOC = '/databases/(default)/documents/'

// ---------- ajudantes
const base = (role, uid) => ({
  uid, nomeCompleto: 'X', email: 'x@x.com', endereco: 'R', dataNascimento: '1990-01-01', contatoEmergenciaNome: 'M',
  contatoEmergenciaTelefone: '1', condicoesMedicas: '', fotoUrl: null, timeId: null, timeNome: null, timeAprovado: false,
  status: 'inadimplente', vencimento: null, ultimoPagamento: null, role, criadoEm: 1, atualizadoEm: 1,
})
const mockGet = (fn, p, data) => ({ function: fn, args: [{ exactValue: DOC + p }], result: { value: { data } } })
const mockBool = (fn, p, v) => ({ function: fn, args: [{ exactValue: DOC + p }], result: { value: v } })

const casos = []
// getAfter sem mock proprio = o mesmo documento que o get (quando o teste nao e de lote)
const comGetAfter = (mocks) => {
  if (!mocks) return mocks
  const extra = mocks
    .filter((m) => m.function === 'get' && !mocks.some((x) => x.function === 'getAfter' && x.args[0].exactValue === m.args[0].exactValue))
    .map((m) => ({ ...m, function: 'getAfter' }))
  return [...mocks, ...extra]
}
function t(nome, expectation, uid, method, p, novo, existente, mocks) {
  casos.push({
    nome,
    tc: {
      expectation,
      request: { auth: uid ? { uid, token: {} } : undefined, path: DOC + p, method, time: '2026-10-05T12:00:00Z', resource: novo ? { data: novo } : undefined },
      resource: existente ? { data: existente } : undefined,
      functionMocks: comGetAfter(mocks),
    },
  })
}
const ts = (...a) => {
  t(...a)
  casos[casos.length - 1].estrito = true
}

const tes = (extra = []) => [mockGet('get', 'players/t1', base('tesoureiro', 't1')), ...extra]
const org = (extra = []) => [mockGet('get', 'players/o1', base('organizador', 'o1')), ...extra]
const adm = (extra = []) => [mockGet('get', 'players/a1', base('admin', 'a1')), ...extra]
const u1 = base('player', 'u1')
const u2 = base('player', 'u2')
const dono = (extra = []) => [mockGet('get', 'players/u1', u1), ...extra]
const multi = (cargos, uid = 'm1') => ({ ...base('player', uid), cargos })
const cartaoBase = { nomeCompleto: 'X', fotoUrl: null, timeNome: null, timeId: null, status: 'inadimplente', vencimento: null, atualizadoEm: 1 }
const FOTO_REAL = 'data:image/jpeg;base64,' + 'A'.repeat(600)

const insc = { gameId: 'g1', gameNome: 'Jogo', uid: 'u1', jogadorNome: 'A', pagoCom: 'pendente', creditosDebitados: 0, status: 'ativa', criadoEm: 1 }
const jogoV = { nome: 'Jogo', data: '2026-10-12', valor: 10, custoCreditos: 10, status: 'aberto', criadoEm: 1, vagas: 5, inscritos: 3, espera: 0 }
const jogoLotado = { ...jogoV, inscritos: 5 }

// ===== baixa com log (quem deu e quando) + estorno
const cobPend = { uid: 'u2', jogadorNome: 'B', valor: 15, txid: 'AACN1', status: 'pendente', criadoEm: 1 }
const cobConf = { ...cobPend, status: 'confirmado', dataPagamento: 5, creditosGerados: 30, confirmadoPor: 't1', confirmadoPorNome: 'Tes', statusAntes: 'inadimplente', vencimentoAntes: null }
const cobEst = { ...cobConf, status: 'estornado', estornadoPor: 't1', estornadoPorNome: 'Tes', estornoMotivo: 'Baixa no jogador errado' }
const baixaNova = (extra = {}) => ({ ...cobPend, status: 'confirmado', dataPagamento: 5, creditosGerados: 30, confirmadoPor: 't1', confirmadoPorNome: 'Tes', statusAntes: 'inadimplente', vencimentoAntes: null, ...extra })

t('baixa: tesoureiro da a baixa assinando', 'ALLOW', 't1', 'update', 'payments/p1', baixaNova(), cobPend, tes())
t('baixa: admin da a baixa assinando', 'ALLOW', 'a1', 'update', 'payments/p1', baixaNova({ confirmadoPor: 'a1', confirmadoPorNome: 'Adm' }), cobPend, adm())
t('baixa: NAO assina em nome de outra pessoa', 'DENY', 't1', 'update', 'payments/p1', baixaNova({ confirmadoPor: 'a1' }), cobPend, tes())
t('baixa: NAO sem dizer quem deu', 'DENY', 't1', 'update', 'payments/p1', (() => { const b = baixaNova(); delete b.confirmadoPor; return b })(), cobPend, tes())
t('baixa: NAO muda o valor junto', 'DENY', 't1', 'update', 'payments/p1', baixaNova({ valor: 1 }), cobPend, tes())
t('baixa: NAO repete a baixa de uma cobranca ja confirmada', 'DENY', 't1', 'update', 'payments/p1', baixaNova(), cobConf, tes())
t('baixa: NAO volta confirmada para pendente', 'DENY', 't1', 'update', 'payments/p1', cobPend, cobConf, tes())
t('baixa: organizador NAO da baixa', 'DENY', 'o1', 'update', 'payments/p1', baixaNova({ confirmadoPor: 'o1' }), cobPend, org())
t('baixa: jogador NAO da baixa no proprio Pix', 'DENY', 'u2', 'update', 'payments/p1', baixaNova({ confirmadoPor: 'u2' }), cobPend, [mockGet('get', 'players/u2', u2)])
ts('baixa (estrito): NAO sem a hora do servidor', 'DENY', 't1', 'update', 'payments/p1', baixaNova(), cobPend, tes())
ts('baixa (estrito): NAO com hora inventada', 'DENY', 't1', 'update', 'payments/p1', baixaNova({ confirmadoEm: '2020-01-01T00:00:00Z' }), cobPend, tes())

t('estorno: tesoureiro estorna com motivo', 'ALLOW', 't1', 'update', 'payments/p1', cobEst, cobConf, tes())
t('estorno: NAO sem motivo', 'DENY', 't1', 'update', 'payments/p1', { ...cobEst, estornoMotivo: '' }, cobConf, tes())
t('estorno: NAO reescreve quem deu a baixa', 'DENY', 't1', 'update', 'payments/p1', { ...cobEst, confirmadoPorNome: 'Outro' }, cobConf, tes())
t('estorno: NAO estorna duas vezes', 'DENY', 't1', 'update', 'payments/p1', { ...cobEst, estornoMotivo: 'Outra vez' }, cobEst, tes())
t('estorno: NAO volta estornada para confirmada', 'DENY', 't1', 'update', 'payments/p1', cobConf, cobEst, tes())
t('estorno: organizador NAO estorna', 'DENY', 'o1', 'update', 'payments/p1', { ...cobEst, estornadoPor: 'o1' }, cobConf, org())
ts('estorno (estrito): NAO sem a hora do servidor', 'DENY', 't1', 'update', 'payments/p1', cobEst, cobConf, tes())

// o vencimento do jogador volta no mesmo lote do estorno (so tesoureiro/admin, e amarrado a cobranca estornada)
const antesEst = { ...u2, status: 'pago', vencimento: 2000, ultimoPagamento: 1500 }
const depoisEst = (extra = {}) => ({ ...antesEst, status: 'inadimplente', vencimento: 1000, ultimoPagamento: null, ultimoEstornoId: 'p1', ...extra })
const loteEst = (extra = []) => tes([mockGet('get', 'payments/p1', cobConf), mockGet('getAfter', 'payments/p1', cobEst), ...extra])
t('estorno/jogador: tesoureiro devolve o vencimento anterior', 'ALLOW', 't1', 'update', 'players/u2', depoisEst(), antesEst, loteEst())
t('estorno/jogador: NAO aumenta o vencimento', 'DENY', 't1', 'update', 'players/u2', depoisEst({ vencimento: 3000 }), antesEst, loteEst())
t('estorno/jogador: NAO se a cobranca nao foi estornada no lote', 'DENY', 't1', 'update', 'players/u2', depoisEst(), antesEst,
  tes([mockGet('get', 'payments/p1', cobConf), mockGet('getAfter', 'payments/p1', cobConf)]))
t('estorno/jogador: NAO inativa o jogador', 'DENY', 't1', 'update', 'players/u2', depoisEst({ status: 'inativo' }), antesEst, loteEst())
t('estorno/jogador: o jogador NAO se estorna sozinho', 'DENY', 'u2', 'update', 'players/u2', depoisEst(), antesEst, [mockGet('get', 'players/u2', antesEst), mockGet('get', 'payments/p1', cobConf), mockGet('getAfter', 'payments/p1', cobEst)])
t('tes: NAO reduz vencimento fora de um estorno', 'DENY', 't1', 'update', 'players/u2', { ...u2, status: 'pago', vencimento: 500 }, { ...u2, vencimento: 1000 }, tes())

// ===== desfazer ajuste manual (lancamento contrario "desfazer_<id>")
const ledAj = { uid: 'u2', tipo: 'ajuste', creditos: 30, saldoApos: 35, descricao: 'Ajuste desfeito: x', refId: 'l1', porUid: 't1', porNome: 'Tes' }
t('desfazer: tesoureiro lanca o ajuste contrario', 'ALLOW', 't1', 'create', 'ledger/desfazer_l1', ledAj, null, tes())
t('desfazer: NAO repete (o lancamento ja existe, seria edicao)', 'DENY', 't1', 'update', 'ledger/desfazer_l1', ledAj, ledAj, tes())
t('desfazer: jogador NAO lanca no proprio extrato', 'DENY', 'u2', 'create', 'ledger/desfazer_l1', { ...ledAj, porUid: 'u2' }, null, [mockGet('get', 'players/u2', u2)])
t('desfazer: organizador NAO lanca', 'DENY', 'o1', 'create', 'ledger/desfazer_l1', { ...ledAj, porUid: 'o1' }, null, org())

// ===== historico de acoes (auditoria), caixa, prestacao de contas e ranking
const regAud = { acao: 'pagamento_baixa', resumo: 'Deu baixa no Pix de R$ 15,00 de Fulano', porUid: 't1', porNome: 'Tes', alvoUid: 'u2', alvoNome: 'Fulano' }
t('auditoria: admin le', 'ALLOW', 'a1', 'get', 'auditoria/r1', null, regAud, adm())
t('auditoria: tesoureiro NAO le', 'DENY', 't1', 'get', 'auditoria/r1', null, regAud, tes())
t('auditoria: jogador NAO le', 'DENY', 'u1', 'get', 'auditoria/r1', null, regAud, dono())
t('auditoria: tesoureiro registra a propria acao', 'ALLOW', 't1', 'create', 'auditoria/r1', regAud, null, tes())
t('auditoria: NAO registra em nome de outra pessoa', 'DENY', 't1', 'create', 'auditoria/r1', { ...regAud, porUid: 'a1' }, null, tes())
t('auditoria: organizador NAO registra baixa', 'DENY', 'o1', 'create', 'auditoria/r1', { ...regAud, porUid: 'o1' }, null, org())
t('auditoria: jogador registra a propria conta excluida', 'ALLOW', 'u1', 'create', 'auditoria/r1', { acao: 'conta_excluida', resumo: 'X excluiu a propria conta', porUid: 'u1', porNome: 'X', alvoUid: 'u1', alvoNome: 'X' }, null, dono())
t('auditoria: jogador NAO registra conta excluida de outro', 'DENY', 'u1', 'create', 'auditoria/r1', { acao: 'conta_excluida', resumo: 'x', porUid: 'u1', porNome: 'X', alvoUid: 'u2', alvoNome: 'Y' }, null, dono())
t('auditoria: NAO acao inventada', 'DENY', 't1', 'create', 'auditoria/r1', { ...regAud, acao: 'apagar_tudo' }, null, tes())
t('auditoria: NAO resumo gigante', 'DENY', 't1', 'create', 'auditoria/r1', { ...regAud, resumo: 'A'.repeat(401) }, null, tes())
t('auditoria: admin NAO edita registro', 'DENY', 'a1', 'update', 'auditoria/r1', { ...regAud, resumo: 'outra coisa' }, regAud, adm())
t('auditoria: admin NAO apaga registro', 'DENY', 'a1', 'delete', 'auditoria/r1', null, regAud, adm())
ts('auditoria (estrito): NAO sem a hora do servidor', 'DENY', 't1', 'create', 'auditoria/r1', regAud, null, tes())

const lanc = { tipo: 'saida', valor: 120.5, data: '2026-10-05', categoria: 'Campo', descricao: 'Aluguel do campo', criadoPor: 't1', criadoPorNome: 'Tes' }
t('caixa: tesoureiro le', 'ALLOW', 't1', 'get', 'caixa/c1', null, lanc, tes())
t('caixa: organizador NAO le', 'DENY', 'o1', 'get', 'caixa/c1', null, lanc, org())
t('caixa: jogador NAO le', 'DENY', 'u1', 'get', 'caixa/c1', null, lanc, dono())
t('caixa: tesoureiro lanca saida', 'ALLOW', 't1', 'create', 'caixa/c1', lanc, null, tes())
t('caixa: NAO valor zero', 'DENY', 't1', 'create', 'caixa/c1', { ...lanc, valor: 0 }, null, tes())
t('caixa: NAO valor negativo', 'DENY', 't1', 'create', 'caixa/c1', { ...lanc, valor: -5 }, null, tes())
t('caixa: NAO tipo inventado', 'DENY', 't1', 'create', 'caixa/c1', { ...lanc, tipo: 'doacao' }, null, tes())
t('caixa: NAO assina em nome de outra pessoa', 'DENY', 't1', 'create', 'caixa/c1', { ...lanc, criadoPor: 'a1' }, null, tes())
t('caixa: organizador NAO lanca', 'DENY', 'o1', 'create', 'caixa/c1', { ...lanc, criadoPor: 'o1' }, null, org())
t('caixa: tesoureiro edita o valor', 'ALLOW', 't1', 'update', 'caixa/c1', { ...lanc, valor: 130, editadoPor: 't1', editadoPorNome: 'Tes' }, lanc, tes())
t('caixa: NAO edita sem assinar', 'DENY', 't1', 'update', 'caixa/c1', { ...lanc, valor: 130 }, lanc, tes())
t('caixa: tesoureiro apaga', 'ALLOW', 't1', 'delete', 'caixa/c1', null, lanc, tes())
t('caixa: jogador NAO apaga', 'DENY', 'u1', 'delete', 'caixa/c1', null, lanc, dono())
ts('caixa (estrito): NAO sem a hora do servidor', 'DENY', 't1', 'create', 'caixa/c1', lanc, null, tes())

const prest = { mes: '2026-10', entradas: 300, saidas: 120.5, saldoMes: 179.5, saldoAcumulado: 500, entradasPorCategoria: { 'Mensalidades (Pix)': 300 }, saidasPorCategoria: { Campo: 120.5 }, publicadoPor: 't1', publicadoPorNome: 'Tes' }
t('prestacao: jogador le', 'ALLOW', 'u1', 'get', 'prestacaoContas/2026-10', null, prest, dono())
t('prestacao: anonimo NAO le', 'DENY', null, 'get', 'prestacaoContas/2026-10', null, prest, [])
t('prestacao: tesoureiro publica', 'ALLOW', 't1', 'create', 'prestacaoContas/2026-10', prest, null, tes())
t('prestacao: NAO mes diferente do id', 'DENY', 't1', 'create', 'prestacaoContas/2026-10', { ...prest, mes: '2026-09' }, null, tes())
t('prestacao: NAO campo extra', 'DENY', 't1', 'create', 'prestacaoContas/2026-10', { ...prest, lancamentos: [] }, null, tes())
t('prestacao: jogador NAO publica', 'DENY', 'u1', 'create', 'prestacaoContas/2026-10', { ...prest, publicadoPor: 'u1' }, null, dono())
ts('prestacao (estrito): NAO sem a hora do servidor', 'DENY', 't1', 'create', 'prestacaoContas/2026-10', prest, null, tes())

const rank = { atualizadoPor: 'o1', atualizadoPorNome: 'Org', jogos: [{ id: 'g1', nome: 'Jogo', data: '2026-10-05', noturno: false, presentes: 3 }], jogadores: { u1: { n: 'X', t: null, ti: null, m: { '2026-10': 1 }, nt: {} } } }
t('ranking: jogador le', 'ALLOW', 'u1', 'get', 'ranking/presencas', null, rank, dono())
t('ranking: organizador monta', 'ALLOW', 'o1', 'update', 'ranking/presencas', rank, rank, org())
t('ranking: jogador NAO monta', 'DENY', 'u1', 'update', 'ranking/presencas', { ...rank, atualizadoPor: 'u1' }, rank, dono())
t('ranking: lojista (parceiro) NAO monta', 'DENY', 'm1', 'update', 'ranking/presencas', { ...rank, atualizadoPor: 'm1' }, rank, [mockGet('get', 'players/m1', multi(['parceiro']))])
t('ranking: NAO outro documento', 'DENY', 'o1', 'create', 'ranking/outro', rank, null, org())
t('ranking: ninguem apaga', 'DENY', 'a1', 'delete', 'ranking/presencas', null, rank, adm())

// ===== quem leu cada aviso (avisoLeituras)
const leitura = { avisoId: 'a1', uid: 'u1', nome: 'X' }
const avisoMock = [mockBool('exists', 'avisos/a1', true)]
t('leitura: jogador registra que leu o aviso', 'ALLOW', 'u1', 'create', 'avisoLeituras/a1_u1', leitura, null, dono([...avisoMock]))
t('leitura: jogador regrava a propria leitura (atualiza a hora)', 'ALLOW', 'u1', 'update', 'avisoLeituras/a1_u1', leitura, leitura, dono([...avisoMock]))
t('leitura: NAO em nome de outra pessoa', 'DENY', 'u1', 'create', 'avisoLeituras/a1_u2', { ...leitura, uid: 'u2' }, null, dono([...avisoMock]))
t('leitura: NAO com id que nao e aviso_uid', 'DENY', 'u1', 'create', 'avisoLeituras/qualquer', leitura, null, dono([...avisoMock]))
t('leitura: NAO de um aviso que nao existe', 'DENY', 'u1', 'create', 'avisoLeituras/a1_u1', leitura, null, dono([mockBool('exists', 'avisos/a1', false)]))
t('leitura: NAO com nome diferente do cadastro', 'DENY', 'u1', 'create', 'avisoLeituras/a1_u1', { ...leitura, nome: 'Outro Nome' }, null, dono([...avisoMock]))
t('leitura: admin le', 'ALLOW', 'a1', 'get', 'avisoLeituras/a1_u1', null, leitura, adm())
t('leitura: organizador le', 'ALLOW', 'o1', 'get', 'avisoLeituras/a1_u1', null, leitura, org())
t('leitura: jogador NAO le a leitura dos outros', 'DENY', 'u1', 'get', 'avisoLeituras/a1_u2', null, { ...leitura, uid: 'u2' }, dono())
t('leitura: organizador apaga (ao apagar o aviso)', 'ALLOW', 'o1', 'delete', 'avisoLeituras/a1_u1', null, leitura, org())
t('leitura: jogador NAO apaga leitura', 'DENY', 'u1', 'delete', 'avisoLeituras/a1_u1', null, leitura, dono())
ts('leitura (estrito): NAO sem a hora do servidor', 'DENY', 'u1', 'create', 'avisoLeituras/a1_u1', leitura, null, dono([...avisoMock]))

// ===== lista de inscritos visivel aos jogadores (so inscricoes ativas e presencas)
const inscDe = (status) => ({ ...insc, uid: 'u2', status })
t('inscritos: jogador le a inscricao ativa de outro', 'ALLOW', 'u1', 'get', 'participations/g1_u2', null, inscDe('ativa'), dono())
t('inscritos: jogador le a presenca de outro', 'ALLOW', 'u1', 'get', 'participations/g1_u2', null, inscDe('presente'), dono())
t('inscritos: jogador NAO le a lista de espera de outro', 'DENY', 'u1', 'get', 'participations/g1_u2', null, inscDe('espera'), dono())
t('inscritos: jogador NAO le inscricao removida de outro', 'DENY', 'u1', 'get', 'participations/g1_u2', null, inscDe('removida'), dono())
t('inscritos: jogador le a propria espera', 'ALLOW', 'u1', 'get', 'participations/g1_u1', null, { ...insc, status: 'espera' }, dono())
t('inscritos: anonimo NAO le', 'DENY', null, 'get', 'participations/g1_u2', null, inscDe('ativa'), [])
t('inscritos: organizador le tudo (inclusive a espera)', 'ALLOW', 'o1', 'get', 'participations/g1_u2', null, inscDe('espera'), org())
t('inscritos: jogador NAO apaga inscricao de outro', 'DENY', 'u1', 'delete', 'participations/g1_u2', null, inscDe('ativa'), dono())

// ===== foto 3x4 obrigatoria: sem foto nao ha inscricao em jogo
const donoSemFoto = (extra = []) => [mockGet('get', 'players/u1', { ...u1, fotoUrl: null }), ...extra]
const donoComFoto = (extra = []) => [mockGet('get', 'players/u1', { ...u1, fotoUrl: FOTO_REAL }), ...extra]
const jogoCont = [mockGet('get', 'games/g1', jogoV), mockGet('getAfter', 'games/g1', { ...jogoV, inscritos: 4 })]
t('foto: com foto, o jogador se inscreve', 'ALLOW', 'u1', 'create', 'participations/g1_u1', insc, null, donoComFoto(jogoCont))
t('foto: SEM foto, o jogador NAO se inscreve', 'DENY', 'u1', 'create', 'participations/g1_u1', insc, null, donoSemFoto(jogoCont))
t('foto: SEM foto, NAO entra nem na lista de espera', 'DENY', 'u1', 'create', 'participations/g1_u1', { ...insc, status: 'espera' }, null,
  donoSemFoto([mockGet('get', 'games/g1', jogoLotado), mockGet('getAfter', 'games/g1', { ...jogoLotado, espera: 1 })]))
t('foto: admin ainda inscreve quem esta sem foto (check-in na hora)', 'ALLOW', 'a1', 'create', 'participations/g1_u1', insc, null, adm())

// ===== foto obrigatoria no cadastro
t('cadastro: nasce com foto', 'ALLOW', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: FOTO_REAL }, null, dono())
t('cadastro: NAO nasce sem foto', 'DENY', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: null }, null, dono())
t('cadastro: NAO nasce sem o campo da foto', 'DENY', 'u1', 'create', 'players/u1', (() => { const d = { ...u1, cpf: '' }; delete d.fotoUrl; return d })(), null, dono())
t('cadastro: NAO com foto minuscula', 'DENY', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: 'data:image/jpeg;base64,AAAA' }, null, dono())
t('cadastro: NAO com texto qualquer no lugar da foto', 'DENY', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: 'x'.repeat(900) }, null, dono())
t('cadastro: NAO com arquivo que nao e imagem', 'DENY', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: 'data:text/html;base64,' + 'A'.repeat(900) }, null, dono())
t('cadastro: NAO com foto gigante', 'DENY', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: 'data:image/jpeg;base64,' + 'A'.repeat(80000) }, null, dono())
t('cadastro: foto grande (69 mil caracteres, o maximo que o app gera) vale', 'ALLOW', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: 'data:image/jpeg;base64,' + 'A'.repeat(69900) }, null, dono())
t('cadastro: NAO nasce com cargos', 'DENY', 'u1', 'create', 'players/u1', { ...u1, cpf: '', fotoUrl: FOTO_REAL, cargos: ['tesoureiro'] }, null, dono())

const comFotoAntiga = { ...u1, fotoUrl: FOTO_REAL }
t('foto: dono troca a propria foto', 'ALLOW', 'u1', 'update', 'players/u1', { ...comFotoAntiga, fotoUrl: 'data:image/jpeg;base64,' + 'B'.repeat(600) }, comFotoAntiga, [mockGet('get', 'players/u1', comFotoAntiga)])
t('foto: dono NAO apaga a propria foto', 'DENY', 'u1', 'update', 'players/u1', { ...comFotoAntiga, fotoUrl: null }, comFotoAntiga, [mockGet('get', 'players/u1', comFotoAntiga)])
t('foto: cadastro antigo sem foto continua editando os outros dados', 'ALLOW', 'u1', 'update', 'players/u1', { ...u1, endereco: 'Rua Nova' }, u1, dono())
t('foto: cadastro antigo sem foto envia a foto depois', 'ALLOW', 'u1', 'update', 'players/u1', { ...u1, fotoUrl: FOTO_REAL }, u1, dono())

// ===== pesos do sorteio (so o admin define) e times sorteados
const pesoDoc = { peso: 5, definidoPor: 'a1', definidoPorNome: 'Adm' }
t('peso: admin define', 'ALLOW', 'a1', 'create', 'pesos/u2', pesoDoc, null, adm())
t('peso: admin muda', 'ALLOW', 'a1', 'update', 'pesos/u2', { ...pesoDoc, peso: 3 }, pesoDoc, adm())
t('peso: tesoureiro NAO define', 'DENY', 't1', 'create', 'pesos/u2', { ...pesoDoc, definidoPor: 't1' }, null, tes())
t('peso: organizador NAO define', 'DENY', 'o1', 'create', 'pesos/u2', { ...pesoDoc, definidoPor: 'o1' }, null, org())
t('peso: jogador NAO define o proprio peso', 'DENY', 'u1', 'create', 'pesos/u1', { ...pesoDoc, definidoPor: 'u1' }, null, dono())
t('peso: NAO assina em nome de outro', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, definidoPor: 'o1' }, null, adm())
t('peso: Highlander (0) vale', 'ALLOW', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: 0 }, null, adm())
t('peso: o topo da escala (9) vale', 'ALLOW', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: 9 }, null, adm())
t('peso: NAO negativo', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: -1 }, null, adm())
t('peso: NAO 10 (a escala vai ate 9)', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: 10 }, null, adm())
t('peso: NAO 11', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: 11 }, null, adm())
t('peso: NAO fracionado', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: 2.5 }, null, adm())
t('peso: NAO em texto', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, peso: '5' }, null, adm())
t('peso: NAO campo extra', 'DENY', 'a1', 'create', 'pesos/u2', { ...pesoDoc, vip: true }, null, adm())
t('peso: admin le', 'ALLOW', 'a1', 'get', 'pesos/u2', null, pesoDoc, adm())
t('peso: tesoureiro le', 'ALLOW', 't1', 'get', 'pesos/u2', null, pesoDoc, tes())
t('peso: organizador le', 'ALLOW', 'o1', 'get', 'pesos/u2', null, pesoDoc, org())
t('peso: jogador NAO le o peso (nem o proprio)', 'DENY', 'u1', 'get', 'pesos/u1', null, { ...pesoDoc }, dono())
t('peso: admin apaga', 'ALLOW', 'a1', 'delete', 'pesos/u2', null, pesoDoc, adm())
t('peso: organizador NAO apaga', 'DENY', 'o1', 'delete', 'pesos/u2', null, pesoDoc, org())
ts('peso (estrito): NAO sem a hora do servidor', 'DENY', 'a1', 'create', 'pesos/u2', pesoDoc, null, adm())

const timesOk = [{ nome: 'Azul', jogadores: [{ uid: 'u1', nome: 'A' }] }, { nome: 'Vermelho', jogadores: [{ uid: 'u2', nome: 'B' }] }]
const sorteio = { gameId: 'g1', times: timesOk, publicado: false, criadoPor: 'o1', criadoPorNome: 'Org' }
t('sorteio: organizador sorteia', 'ALLOW', 'o1', 'create', 'sorteios/g1', sorteio, null, org())
t('sorteio: tesoureiro sorteia', 'ALLOW', 't1', 'create', 'sorteios/g1', { ...sorteio, criadoPor: 't1' }, null, tes())
t('sorteio: admin sorteia', 'ALLOW', 'a1', 'create', 'sorteios/g1', { ...sorteio, criadoPor: 'a1' }, null, adm())
t('sorteio: sortear de novo (refaz tudo, hora nova)', 'ALLOW', 'o1', 'update', 'sorteios/g1', { ...sorteio, times: [timesOk[1], timesOk[0]] }, sorteio, org())
t('sorteio: outro membro da equipe publica (so muda o publicado)', 'ALLOW', 't1', 'update', 'sorteios/g1', { ...sorteio, publicado: true }, sorteio, tes())
t('sorteio: publicar NAO mexe nos times', 'DENY', 't1', 'update', 'sorteios/g1', { ...sorteio, publicado: true, times: [timesOk[1], timesOk[0]] }, sorteio, tes())
ts('sorteio (estrito): publicar NAO troca quem sorteou', 'DENY', 't1', 'update', 'sorteios/g1', { ...sorteio, publicado: true, criadoPor: 't1' }, sorteio, tes())
t('sorteio: jogador NAO sorteia', 'DENY', 'u1', 'create', 'sorteios/g1', { ...sorteio, criadoPor: 'u1' }, null, dono())
t('sorteio: lojista (parceiro) NAO sorteia', 'DENY', 'm1', 'create', 'sorteios/g1', { ...sorteio, criadoPor: 'm1' }, null, [mockGet('get', 'players/m1', multi(['parceiro']))])
t('sorteio: NAO assina em nome de outro', 'DENY', 'o1', 'create', 'sorteios/g1', { ...sorteio, criadoPor: 'a1' }, null, org())
t('sorteio: NAO com id diferente do jogo', 'DENY', 'o1', 'create', 'sorteios/g1', { ...sorteio, gameId: 'g2' }, null, org())
t('sorteio: NAO com 1 time so', 'DENY', 'o1', 'create', 'sorteios/g1', { ...sorteio, times: [timesOk[0]] }, null, org())
t('sorteio: NAO com 9 times', 'DENY', 'o1', 'create', 'sorteios/g1', { ...sorteio, times: Array.from({ length: 9 }, (_, i) => ({ nome: 'T' + i, jogadores: [] })) }, null, org())
t('sorteio: NAO campo extra (como os pesos)', 'DENY', 'o1', 'create', 'sorteios/g1', { ...sorteio, pesos: { u1: 5 } }, null, org())
t('sorteio: NAO times que nao e lista', 'DENY', 'o1', 'create', 'sorteios/g1', { ...sorteio, times: 'x' }, null, org())
t('sorteio: equipe le o rascunho (nao publicado)', 'ALLOW', 'o1', 'get', 'sorteios/g1', null, sorteio, org())
t('sorteio: jogador NAO le o rascunho', 'DENY', 'u1', 'get', 'sorteios/g1', null, sorteio, dono())
t('sorteio: jogador le o sorteio publicado', 'ALLOW', 'u1', 'get', 'sorteios/g1', null, { ...sorteio, publicado: true }, dono())
t('sorteio: anonimo NAO le', 'DENY', null, 'get', 'sorteios/g1', null, { ...sorteio, publicado: true }, [])
t('sorteio: organizador apaga', 'ALLOW', 'o1', 'delete', 'sorteios/g1', null, sorteio, org())
t('sorteio: jogador NAO apaga', 'DENY', 'u1', 'delete', 'sorteios/g1', null, { ...sorteio, publicado: true }, dono())
ts('sorteio (estrito): NAO sem a hora do servidor', 'DENY', 'o1', 'create', 'sorteios/g1', sorteio, null, org())

const regSorteio = { acao: 'sorteio_times', resumo: 'Sorteou os times', porUid: 'o1', porNome: 'Org', alvoUid: null, alvoNome: null }
t('auditoria: organizador registra o sorteio', 'ALLOW', 'o1', 'create', 'auditoria/r1', regSorteio, null, org())
t('auditoria: organizador NAO registra baixa de Pix', 'DENY', 'o1', 'create', 'auditoria/r1', { ...regSorteio, acao: 'pagamento_baixa' }, null, org())
t('auditoria: admin registra o peso do sorteio', 'ALLOW', 'a1', 'create', 'auditoria/r1', { ...regSorteio, acao: 'peso_sorteio', porUid: 'a1', porNome: 'Adm' }, null, adm())
t('auditoria: jogador NAO registra sorteio', 'DENY', 'u1', 'create', 'auditoria/r1', { ...regSorteio, porUid: 'u1' }, null, dono())

// ---------- execucao
;(async () => {
  const token = await auth.getAccessToken(cfg.tokens.refresh_token, [])
  const regras = fs.readFileSync(process.env.RULES || path.join(__dirname, '..', 'firestore.rules'), 'utf8')
  // a API de teste nao representa datas: nos casos comuns, "hora do servidor ausente" passa; os casos "ts" rodam nas regras reais
  const campos = '(confirmadoEm|estornadoEm|criadoEm|editadoEm|publicadoEm|lidoEm|definidoEm)'
  const regrasTestaveis = regras.replace(new RegExp("get[(]'" + campos + "', null[)] == request[.]time", 'g'), "get('$1', request.time) == request.time")
  if (regrasTestaveis === regras) throw new Error('substituicao de hora nao aplicada')
  let falhas = 0
  for (const [texto, lista] of [[regrasTestaveis, casos.filter((c) => !c.estrito)], [regras, casos.filter((c) => c.estrito)]]) {
    for (let k = 0; k < lista.length; k += 100) {
      const grupo = lista.slice(k, k + 100)
      const r = await fetch('https://firebaserules.googleapis.com/v1/projects/aacn-app:test', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (token.access_token || token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: texto }] }, testSuite: { testCases: grupo.map((c) => c.tc) } }),
      })
      const j = await r.json()
      if (!r.ok) {
        console.log(r.status, JSON.stringify(j).slice(0, 500))
        falhas += grupo.length
        continue
      }
      if (j.issues?.length) console.log('avisos das regras:', JSON.stringify(j.issues))
      ;(j.testResults ?? []).forEach((x, n) => {
        if (x.state !== 'SUCCESS') {
          falhas++
          console.log('FALHA', grupo[n].nome, JSON.stringify(x.debugMessages ?? '').slice(0, 300))
        }
      })
    }
  }
  console.log(casos.length - falhas + '/' + casos.length + ' corretos')
  process.exitCode = falhas ? 1 : 0
})()
