/**
 * Texto do verso da carteirinha (cabe em 85,6 x 54 mm com fonte pequena).
 *
 * BASE LEGAL: cada item cita a norma e o artigo. Foram conferidos em 10/2026 contra:
 *  - Decreto nº 12.345/2024 (publicação original), que alterou o Decreto nº 11.615/2023;
 *  - Portaria nº 56-COLOG/2017 (texto no site do Exército, SGEx);
 *  - Portaria nº 02-COLOG/2010 (duas bases de legislação; não foi possível abrir a página do
 *    DFPC/Exército para confirmar se segue integralmente vigente).
 * A diretoria deve confirmar com um advogado ou com o Exército (DFPC) antes de imprimir e
 * revisar sempre que houver norma nova.
 */
export const TITULO_LEGAL = 'Base legal: airsoft (armas de pressão)'

export const ITENS_LEGAIS: { texto: string; ref: string }[] = [
  {
    texto: 'Airsoft é arma de pressão (esporte/recreação), não arma de fogo.',
    ref: 'Port. 02-COLOG/2010, art. 2º, II e par. único.',
  },
  {
    texto: 'Uso permitido de armas de pressão (gás ou mola) até 6,35 mm.',
    ref: 'Dec. 11.615/2023, art. 11, §1º (red. Dec. 12.345/2024).',
  },
  {
    texto: 'Pessoa física é dispensada de registro no Exército para usar arma de pressão.',
    ref: 'Port. 56-COLOG/2017, art. 2º.',
  },
  {
    texto: 'Ponta do cano laranja fluorescente ou vermelha é obrigatória.',
    ref: 'Port. 02-COLOG/2010, art. 18.',
  },
  {
    texto: 'Não conduzir ostensivamente; levar comprovante de origem (nota fiscal).',
    ref: 'Port. 02-COLOG/2010, art. 13, §§2º e 3º.',
  },
]

export const NOTA_LEGAL = 'O portador é associado da AACN e pratica airsoft de forma recreativa.'

export const TITULO_CONDUTA = 'Conduta do associado'

export const REGRAS_CONDUTA: string[] = [
  'Óculos de proteção fechados no jogo. Jogue só em locais autorizados.',
  'Transporte em maleta, descarregada. Não exiba em via pública.',
  'Respeite o limite de FPS/joule e a distância mínima de tiro.',
  'Nunca aponte a quem não joga. Fair play: sinalize o acerto.',
  'Proibido álcool e drogas. Siga a organização.',
  'Pessoal e intransferível. Leia o QR para conferir a situação.',
]
