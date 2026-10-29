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

// ===== convidado: quem nao e associado joga so um jogo e paga em dinheiro; o organizador/tesouraria o inscreve ja presente
const conv = { gameId: 'g1', gameNome: 'Jogo', uid: 'convidado_abc12345xyz9', jogadorNome: 'Visitante da Silva', pagoCom: 'dinheiro', creditosDebitados: 0, status: 'presente', checkInPor: 'o1', checkInPorNome: 'Org', convidado: true }
const idConv = 'participations/g1_convidado_abc12345xyz9'
const loteConv = (mocks = org()) => [...mocks, mockGet('get', 'games/g1', jogoV), mockGet('getAfter', 'games/g1', { ...jogoV, inscritos: 4 })]
const loteSaiConv = (mocks = org()) => [...mocks, mockGet('get', 'games/g1', jogoV), mockGet('getAfter', 'games/g1', { ...jogoV, inscritos: 2 })]
t('convidado: organizador inscreve ja presente, em dinheiro', 'ALLOW', 'o1', 'create', idConv, conv, null, loteConv())
t('convidado: tesoureiro inscreve', 'ALLOW', 't1', 'create', idConv, { ...conv, checkInPor: 't1', checkInPorNome: 'Tes' }, null, loteConv(tes()))
t('convidado: admin inscreve', 'ALLOW', 'a1', 'create', idConv, { ...conv, checkInPor: 'a1', checkInPorNome: 'Adm' }, null, loteConv(adm()))
t('convidado: jogador NAO inscreve convidado', 'DENY', 'u1', 'create', idConv, { ...conv, checkInPor: 'u1' }, null, loteConv(dono()))
t('convidado: NAO paga com creditos (nao tem carteira)', 'DENY', 'o1', 'create', idConv, { ...conv, pagoCom: 'creditos', creditosDebitados: 10 }, null, loteConv())
t('convidado: NAO fica pendente de pagamento', 'DENY', 'o1', 'create', idConv, { ...conv, pagoCom: 'pendente' }, null, loteConv())
t('convidado: NAO debita creditos junto com o dinheiro', 'DENY', 'o1', 'create', idConv, { ...conv, creditosDebitados: 10 }, null, loteConv())
t('convidado: NAO entra so como inscrito (a presenca ja vem confirmada)', 'DENY', 'o1', 'create', idConv, { ...conv, status: 'ativa' }, null, loteConv())
t('convidado: NAO usa o uid de um associado', 'DENY', 'o1', 'create', 'participations/g1_u2', { ...conv, uid: 'u2' }, null, loteConv())
t('convidado: NAO sem a marca de convidado', 'DENY', 'o1', 'create', idConv, { ...conv, convidado: false }, null, loteConv())
t('convidado: NAO id diferente de jogo_uid', 'DENY', 'o1', 'create', 'participations/g1_convidado_outro1234', conv, null, loteConv())
t('convidado: NAO assina o check-in por outra pessoa', 'DENY', 'o1', 'create', idConv, { ...conv, checkInPor: 'a1' }, null, loteConv())
t('convidado: NAO sem subir o contador de inscritos do jogo', 'DENY', 'o1', 'create', idConv, conv, null, [...org(), mockGet('get', 'games/g1', jogoV), mockGet('getAfter', 'games/g1', jogoV)])
t('convidado: NAO sobe o contador de 2 em 2', 'DENY', 'o1', 'create', idConv, conv, null, [...org(), mockGet('get', 'games/g1', jogoV), mockGet('getAfter', 'games/g1', { ...jogoV, inscritos: 5 })])
t('convidado: NAO campo extra na inscricao', 'DENY', 'o1', 'create', idConv, { ...conv, contato: '62999999999' }, null, loteConv())
t('convidado: NAO nome de uma letra so', 'DENY', 'o1', 'create', idConv, { ...conv, jogadorNome: 'A' }, null, loteConv())
t('convidado: NAO nome gigante', 'DENY', 'o1', 'create', idConv, { ...conv, jogadorNome: 'A'.repeat(81) }, null, loteConv())
ts('convidado (estrito): NAO sem a hora do servidor', 'DENY', 'o1', 'create', idConv, conv, null, loteConv())
ts('convidado (estrito): NAO com hora inventada', 'DENY', 'o1', 'create', idConv, { ...conv, presenteEm: '2020-01-01T00:00:00Z', criadoEm: '2020-01-01T00:00:00Z' }, null, loteConv())
t('convidado: jogadores veem o convidado na lista de inscritos', 'ALLOW', 'u1', 'get', idConv, null, conv, dono())
t('convidado: organizador desfaz o que ele mesmo lancou (a vaga volta)', 'ALLOW', 'o1', 'delete', idConv, null, conv, loteSaiConv())
t('convidado: organizador NAO desfaz convidado lancado por outro', 'DENY', 'o1', 'delete', idConv, null, { ...conv, checkInPor: 'a1' }, loteSaiConv())
t('convidado: organizador NAO desfaz sem devolver a vaga', 'DENY', 'o1', 'delete', idConv, null, conv, [...org(), mockGet('get', 'games/g1', jogoV), mockGet('getAfter', 'games/g1', jogoV)])
t('convidado: organizador NAO apaga a presenca de um associado', 'DENY', 'o1', 'delete', 'participations/g1_u2', null, { ...inscDe('presente'), checkInPor: 'o1' }, loteSaiConv())
t('convidado: jogador NAO apaga convidado', 'DENY', 'u1', 'delete', idConv, null, conv, loteSaiConv(dono()))
t('convidado: tesoureiro retira convidado de qualquer organizador', 'ALLOW', 't1', 'delete', idConv, null, conv, loteSaiConv(tes()))
t('convidado: organizador NAO edita a inscricao do convidado', 'DENY', 'o1', 'update', idConv, { ...conv, jogadorNome: 'Outro Nome' }, conv, loteConv())
t('convidado: organizador NAO passa o convidado para creditos', 'DENY', 'o1', 'update', idConv, { ...conv, pagoCom: 'creditos', creditosDebitados: 10 }, conv, loteConv())
t('convidado: organizador sobe o contador de inscritos do jogo', 'ALLOW', 'o1', 'update', 'games/g1', { ...jogoV, inscritos: 4 }, jogoV, org())
t('convidado: organizador registra a acao no historico', 'ALLOW', 'o1', 'create', 'auditoria/r1', { acao: 'convidado', resumo: 'Inscreveu o convidado X no jogo "Jogo" (pagou R$ 10,00 em dinheiro)', porUid: 'o1', porNome: 'Org' }, null, org())
t('convidado: organizador NAO registra outras acoes no historico', 'DENY', 'o1', 'create', 'auditoria/r1', { acao: 'jogo_excluido', resumo: 'x', porUid: 'o1', porNome: 'Org' }, null, org())

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

// ===== sequencia de mensalidades (1 ano de AACN = 12 seguidas) e fim da conquista Assiduo
const seq = { meses: 12 }
t('sequencia: tesoureiro grava na baixa', 'ALLOW', 't1', 'update', 'sequencias/u2', seq, { meses: 11 }, tes())
t('sequencia: admin grava', 'ALLOW', 'a1', 'create', 'sequencias/u2', { meses: 1 }, null, adm())
t('sequencia: zerar (reset/estorno) vale', 'ALLOW', 't1', 'update', 'sequencias/u2', { meses: 0 }, seq, tes())
t('sequencia: organizador NAO grava', 'DENY', 'o1', 'update', 'sequencias/u2', seq, { meses: 1 }, org())
t('sequencia: jogador NAO grava a propria', 'DENY', 'u1', 'update', 'sequencias/u1', seq, { meses: 1 }, dono())
t('sequencia: jogador NAO cria a propria', 'DENY', 'u1', 'create', 'sequencias/u1', seq, null, dono())
t('sequencia: NAO campo extra', 'DENY', 't1', 'update', 'sequencias/u2', { ...seq, bonus: 100 }, seq, tes())
t('sequencia: NAO negativa', 'DENY', 't1', 'update', 'sequencias/u2', { meses: -1 }, seq, tes())
t('sequencia: NAO em texto', 'DENY', 't1', 'update', 'sequencias/u2', { meses: '12' }, seq, tes())
t('sequencia: NAO fracionada', 'DENY', 't1', 'update', 'sequencias/u2', { meses: 12.5 }, seq, tes())
t('sequencia: NAO absurda', 'DENY', 't1', 'update', 'sequencias/u2', { meses: 5000 }, seq, tes())
t('sequencia: dono le a propria', 'ALLOW', 'u1', 'get', 'sequencias/u1', null, seq, dono())
t('sequencia: jogador NAO le a de outro', 'DENY', 'u1', 'get', 'sequencias/u2', null, seq, dono())
t('sequencia: tesoureiro le', 'ALLOW', 't1', 'get', 'sequencias/u2', null, seq, tes())
t('sequencia: dono apaga junto com a conta', 'ALLOW', 'u1', 'delete', 'sequencias/u1', null, seq, dono())
t('sequencia: jogador NAO apaga a de outro', 'DENY', 'u1', 'delete', 'sequencias/u2', null, seq, dono())
t('sequencia: admin apaga', 'ALLOW', 'a1', 'delete', 'sequencias/u2', null, seq, adm())

const noAno = (meses) => dono([mockGet('get', 'sequencias/u1', { meses })])
t('ano: 12 mensalidades seguidas libera os 100 creditos', 'ALLOW', 'u1', 'create', 'conquistas/u1_ano', { uid: 'u1', conquista: 'ano', creditos: 100 }, null, noAno(12))
t('ano: mais de 12 tambem vale', 'ALLOW', 'u1', 'create', 'conquistas/u1_ano', { uid: 'u1', conquista: 'ano', creditos: 100 }, null, noAno(18))
t('ano: 11 NAO basta', 'DENY', 'u1', 'create', 'conquistas/u1_ano', { uid: 'u1', conquista: 'ano', creditos: 100 }, null, noAno(11))
t('ano: sem sequencia registrada NAO libera', 'DENY', 'u1', 'create', 'conquistas/u1_ano', { uid: 'u1', conquista: 'ano', creditos: 100 }, null, dono())
t('ano: NAO com valor diferente de 100', 'DENY', 'u1', 'create', 'conquistas/u1_ano', { uid: 'u1', conquista: 'ano', creditos: 500 }, null, noAno(12))
t('ano: admin ainda concede na mao (excecao)', 'ALLOW', 'a1', 'create', 'conquistas/u2_ano', { uid: 'u2', conquista: 'ano', creditos: 100, concedidaPor: 'a1', concedidaPorNome: 'Adm' }, null, adm())
t('lenda: continua valendo com 25 jogos', 'ALLOW', 'u1', 'create', 'conquistas/u1_lenda', { uid: 'u1', conquista: 'lenda', creditos: 20 }, null, dono([mockGet('get', 'stats/u1', { jogos: 25 })]))
t('assiduo: NAO existe mais (jogador nao resgata)', 'DENY', 'u1', 'create', 'conquistas/u1_assiduo', { uid: 'u1', conquista: 'assiduo', creditos: 20 }, null, dono([mockGet('get', 'stats/u1', { jogos: 30 })]))
t('assiduo: NAO existe mais (admin nao concede)', 'DENY', 'a1', 'create', 'conquistas/u2_assiduo', { uid: 'u2', conquista: 'assiduo', creditos: 20, concedidaPor: 'a1', concedidaPorNome: 'Adm' }, null, adm())

// ===== aniversario: 10 creditos, so no dia (horario de Brasilia, UTC-3), uma vez por ano, e so se o jogador marcar "Lido"
// th(hora, ...) = t(...) com a hora do pedido trocada (a hora padrao dos casos e 2026-10-05T12:00Z = 05/10 09:00 em Brasilia)
const th = (hora, ...a) => {
  t(...a)
  casos[casos.length - 1].tc.request.time = hora
}
const nasc = (data) => [mockGet('get', 'players/u1', { ...u1, dataNascimento: data })]
const aniv = { uid: 'u1', ano: 2026, creditos: 10 }
t('aniversario: no dia, o jogador recebe o bonus de 10', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-05'))
t('aniversario: NAO fora do dia (dia seguinte)', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-06'))
t('aniversario: NAO fora do dia (dia anterior)', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-04'))
t('aniversario: NAO em outro mes com o mesmo dia', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-11-05'))
t('aniversario: o ano de nascimento nao importa (nasceu em 2005)', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('2005-10-05'))
t('aniversario: NAO sem data de nascimento no cadastro', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc(''))
t('aniversario: NAO com data de nascimento malformada', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('05/10/1990'))
t('aniversario: NAO valor diferente de 10 (11)', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', { ...aniv, creditos: 11 }, null, nasc('1990-10-05'))
t('aniversario: NAO valor zero', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', { ...aniv, creditos: 0 }, null, nasc('1990-10-05'))
t('aniversario: NAO com o ano de outro ano (id e campo de 2025)', 'DENY', 'u1', 'create', 'aniversarios/u1_2025', { ...aniv, ano: 2025 }, null, nasc('1990-10-05'))
t('aniversario: NAO com id de um ano e campo de outro', 'DENY', 'u1', 'create', 'aniversarios/u1_2025', aniv, null, nasc('1990-10-05'))
t('aniversario: NAO ano como texto', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', { ...aniv, ano: '2026' }, null, nasc('1990-10-05'))
t('aniversario: NAO em nome de outra pessoa', 'DENY', 'u1', 'create', 'aniversarios/u2_2026', { ...aniv, uid: 'u2' }, null, nasc('1990-10-05'))
t('aniversario: NAO campo extra', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', { ...aniv, bonus: 99 }, null, nasc('1990-10-05'))
t('aniversario: admin NAO recebe por outra pessoa', 'DENY', 'a1', 'create', 'aniversarios/u1_2026', aniv, null, [...adm(), ...nasc('1990-10-05')])
t('aniversario: NAO se edita depois', 'DENY', 'u1', 'update', 'aniversarios/u1_2026', { ...aniv, creditos: 20 }, aniv, nasc('1990-10-05'))
t('aniversario: jogador NAO apaga (para receber de novo)', 'DENY', 'u1', 'delete', 'aniversarios/u1_2026', null, aniv, nasc('1990-10-05'))
t('aniversario: admin apaga (reset de teste)', 'ALLOW', 'a1', 'delete', 'aniversarios/u1_2026', null, aniv, adm())
t('aniversario: jogador consulta se ja recebeu (mesmo sem o documento)', 'ALLOW', 'u1', 'get', 'aniversarios/u1_2026', null, null, dono())
t('aniversario: jogador le o proprio registro', 'ALLOW', 'u1', 'get', 'aniversarios/u1_2026', null, aniv, dono())
t('aniversario: jogador NAO le o de outro', 'DENY', 'u1', 'get', 'aniversarios/u2_2026', null, { ...aniv, uid: 'u2' }, dono())
t('aniversario: tesoureiro le', 'ALLOW', 't1', 'get', 'aniversarios/u1_2026', null, aniv, tes())
t('aniversario: organizador NAO le', 'DENY', 'o1', 'get', 'aniversarios/u1_2026', null, aniv, org())
ts('aniversario (estrito): NAO sem a hora do servidor', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-05'))
ts('aniversario (estrito): NAO com hora inventada', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', { ...aniv, criadoEm: '2020-01-01T00:00:00Z' }, null, nasc('1990-10-05'))

// fuso: a data vale em Brasilia (UTC-3), nao em UTC
th('2026-10-05T03:00:00Z', 'aniversario (fuso): 00:00 em Brasilia ja e o dia', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-05'))
th('2026-10-06T02:59:00Z', 'aniversario (fuso): 23:59 em Brasilia ainda e o dia', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-05'))
th('2026-10-05T02:59:00Z', 'aniversario (fuso): 23:59 da vespera em Brasilia NAO e o dia (mesmo sendo 05/10 em UTC)', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-05'))
th('2026-10-06T03:00:00Z', 'aniversario (fuso): 00:00 do dia seguinte em Brasilia NAO e o dia', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-10-05'))
th('2027-01-01T01:00:00Z', 'aniversario (fuso): 31/12 as 22h em Brasilia vale com o ano de 2026', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1990-12-31'))
th('2027-01-01T01:00:00Z', 'aniversario (fuso): 31/12 as 22h em Brasilia NAO vale com o ano de 2027', 'DENY', 'u1', 'create', 'aniversarios/u1_2027', { ...aniv, ano: 2027 }, null, nasc('1990-12-31'))
// quem nasceu em 29/02 comemora em 28/02 nos anos sem 29/02
th('2026-02-28T12:00:00Z', 'aniversario (29/02): em ano comum vale em 28/02', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1992-02-29'))
th('2026-03-01T12:00:00Z', 'aniversario (29/02): em ano comum NAO vale em 01/03', 'DENY', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1992-02-29'))
th('2028-02-28T12:00:00Z', 'aniversario (29/02): em ano bissexto NAO vale em 28/02', 'DENY', 'u1', 'create', 'aniversarios/u1_2028', { ...aniv, ano: 2028 }, null, nasc('1992-02-29'))
th('2028-02-29T12:00:00Z', 'aniversario (29/02): em ano bissexto vale em 29/02', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2028', { ...aniv, ano: 2028 }, null, nasc('1992-02-29'))
th('2026-02-28T12:00:00Z', 'aniversario (29/02): quem nasceu em 28/02 tambem vale em 28/02', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2026', aniv, null, nasc('1992-02-28'))
th('2100-02-28T12:00:00Z', 'aniversario (29/02): 2100 nao e bissexto (28/02 vale)', 'ALLOW', 'u1', 'create', 'aniversarios/u1_2100', { ...aniv, ano: 2100 }, null, nasc('1992-02-29'))

// a carteira soma exatamente o bonus e so junto com o documento do ano
const cart = { creditos: 5, ultimoJogoId: null }
const loteAniv = (extra = []) => dono([mockBool('exists', 'aniversarios/u1_2026', false), mockBool('existsAfter', 'aniversarios/u1_2026', true), mockGet('getAfter', 'aniversarios/u1_2026', aniv), ...extra])
t('aniversario/carteira: soma os 10 junto com o documento do ano', 'ALLOW', 'u1', 'update', 'wallets/u1', { ...cart, creditos: 15, ultimoAniversarioId: '2026' }, cart, loteAniv())
t('aniversario/carteira: NAO soma mais que o bonus', 'DENY', 'u1', 'update', 'wallets/u1', { ...cart, creditos: 25, ultimoAniversarioId: '2026' }, cart, loteAniv())
t('aniversario/carteira: NAO soma sem o documento do ano no lote', 'DENY', 'u1', 'update', 'wallets/u1', { ...cart, creditos: 15, ultimoAniversarioId: '2026' }, cart,
  dono([mockBool('exists', 'aniversarios/u1_2026', false), mockBool('existsAfter', 'aniversarios/u1_2026', false)]))
t('aniversario/carteira: NAO soma de novo se o documento do ano ja existia', 'DENY', 'u1', 'update', 'wallets/u1', { ...cart, creditos: 15, ultimoAniversarioId: '2026' }, cart,
  dono([mockBool('exists', 'aniversarios/u1_2026', true), mockBool('existsAfter', 'aniversarios/u1_2026', true), mockGet('getAfter', 'aniversarios/u1_2026', aniv)]))
t('aniversario/carteira: NAO mexe em outro campo junto', 'DENY', 'u1', 'update', 'wallets/u1', { ...cart, creditos: 15, ultimoAniversarioId: '2026', ultimoJogoId: 'g1' }, cart, loteAniv())

const ledAniv = { uid: 'u1', tipo: 'bonus', creditos: 10, saldoApos: 15, descricao: 'Feliz aniversario', refId: '2026', porUid: 'u1', porNome: 'X' }
const loteLed = (extra = []) =>
  dono([
    mockBool('existsAfter', 'aniversarios/u1_2026', true), mockGet('getAfter', 'aniversarios/u1_2026', aniv),
    mockGet('get', 'wallets/u1', cart), mockGet('getAfter', 'wallets/u1', { ...cart, creditos: 15, ultimoAniversarioId: '2026' }), ...extra,
  ])
t('aniversario/extrato: lanca o bonus amarrado ao documento do ano e a carteira', 'ALLOW', 'u1', 'create', 'ledger/aniversario_u1_2026', ledAniv, null, loteLed())
t('aniversario/extrato: NAO com id diferente de aniversario_uid_ano', 'DENY', 'u1', 'create', 'ledger/qualquer', ledAniv, null, loteLed())
t('aniversario/extrato: NAO com valor diferente do bonus', 'DENY', 'u1', 'create', 'ledger/aniversario_u1_2026', { ...ledAniv, creditos: 50, saldoApos: 55 }, null, loteLed())
t('aniversario/extrato: NAO com saldo que nao bate com a carteira', 'DENY', 'u1', 'create', 'ledger/aniversario_u1_2026', { ...ledAniv, saldoApos: 99 }, null, loteLed())
t('aniversario/extrato: NAO sem o documento do ano no lote', 'DENY', 'u1', 'create', 'ledger/aniversario_u1_2026', ledAniv, null, dono([mockBool('existsAfter', 'aniversarios/u1_2026', false)]))
t('aniversario/extrato: NAO em nome de outra pessoa', 'DENY', 'u1', 'create', 'ledger/aniversario_u2_2026', { ...ledAniv, uid: 'u2' }, null, loteLed())

// a data de nascimento nao e trocada pelo proprio jogador depois de informada (senao o bonus seria de qualquer dia)
t('nascimento: jogador NAO troca a data ja informada', 'DENY', 'u1', 'update', 'players/u1', { ...u1, dataNascimento: '1990-10-05' }, u1, dono())
t('nascimento: jogador preenche quando o cadastro antigo esta sem a data', 'ALLOW', 'u1', 'update', 'players/u1', { ...u1, dataNascimento: '1990-10-05' }, { ...u1, dataNascimento: '' }, [mockGet('get', 'players/u1', { ...u1, dataNascimento: '' })])
t('nascimento: jogador salva o resto do perfil com a data igual', 'ALLOW', 'u1', 'update', 'players/u1', { ...u1, endereco: 'Rua Nova' }, u1, dono())
t('nascimento: admin corrige a data', 'ALLOW', 'a1', 'update', 'players/u1', { ...u1, dataNascimento: '1991-02-03' }, u1, adm())

// ---------- execucao
;(async () => {
  const token = await auth.getAccessToken(cfg.tokens.refresh_token, [])
  const regras = fs.readFileSync(process.env.RULES || path.join(__dirname, '..', 'firestore.rules'), 'utf8')
  // a API de teste nao representa datas: nos casos comuns, "hora do servidor ausente" passa; os casos "ts" rodam nas regras reais
  const campos = '(confirmadoEm|estornadoEm|criadoEm|editadoEm|publicadoEm|lidoEm|definidoEm|presenteEm)'
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
