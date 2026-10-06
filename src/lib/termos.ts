/**
 * Termo de responsabilidade e política de privacidade da AACN.
 * ATENÇÃO: é um texto-modelo geral. A diretoria deve revisar com um advogado antes de colocar
 * em uso. Ao alterar o conteúdo, mude VERSAO_TERMOS: todos os associados precisarão aceitar de novo.
 */
export const VERSAO_TERMOS = '2026-10-v1'

export interface Secao {
  titulo: string
  texto: string
}

export const TERMO_RESPONSABILIDADE: Secao[] = [
  {
    titulo: '1. Ciência dos riscos',
    texto:
      'Declaro que sei que o airsoft é uma atividade recreativa e esportiva praticada com réplicas que disparam esferas plásticas e que, mesmo com todas as medidas de segurança, existem riscos inerentes, como lesões oculares, contusões, quedas, desidratação e outros acidentes.',
  },
  {
    titulo: '2. Condições de saúde',
    texto:
      'Declaro estar em condições físicas e de saúde adequadas para a prática, e que informei à AACN, no meu cadastro, qualquer condição médica ou necessidade especial relevante. Comprometo-me a manter essas informações atualizadas e a avisar a organização se me sentir mal durante qualquer atividade.',
  },
  {
    titulo: '3. Equipamentos e proteção',
    texto:
      'Comprometo-me a usar proteção ocular fechada em toda a área de jogo e os demais equipamentos exigidos pela organização, e a manter minha réplica dentro do limite de potência definido para cada jogo, permitindo a conferência (cronagem) sempre que solicitada.',
  },
  {
    titulo: '4. Regras, conduta e legislação',
    texto:
      'Comprometo-me a cumprir as normas de segurança e de conduta da AACN e as instruções dos organizadores e árbitros, a jogar apenas em locais e eventos autorizados, a transportar minhas réplicas de forma adequada, sem exibi-las em vias ou locais públicos, e a respeitar a legislação brasileira aplicável às armas de pressão. É proibido participar sob efeito de álcool ou drogas. Condutas antidesportivas ou inseguras podem levar à advertência, expulsão do jogo ou suspensão da associação.',
  },
  {
    titulo: '5. Responsabilidade',
    texto:
      'Assumo a responsabilidade pelos meus atos e pelo meu equipamento. Na medida permitida em lei, reconheço que a AACN e seus organizadores não respondem por acidentes decorrentes do descumprimento das regras ou dos riscos próprios da atividade que assumi conscientemente, sem prejuízo das responsabilidades que a lei não permite afastar.',
  },
  {
    titulo: '6. Menores de 18 anos',
    texto:
      'A participação de menores de 18 anos depende de autorização e acompanhamento do responsável legal, que declara ter lido e concordado com este termo, assume as obrigações nele previstas e responde pelo menor.',
  },
  {
    titulo: '7. Aceite eletrônico',
    texto:
      'Ao marcar a opção de aceite no aplicativo, manifesto minha concordância com este termo e com a Política de Privacidade. O aceite é registrado com a data e a versão do documento. Quando o termo for atualizado, será necessário aceitar novamente.',
  },
]

export const POLITICA_PRIVACIDADE: Secao[] = [
  {
    titulo: '1. Quem somos',
    texto:
      'A Associação de Airsoft de Caldas Novas (AACN) é a controladora dos dados pessoais tratados neste aplicativo, nos termos da Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).',
  },
  {
    titulo: '2. Dados que coletamos',
    texto:
      'Nome, e-mail, data de nascimento, endereço, celular, foto 3x4, contato de emergência, condições médicas ou necessidades especiais (dado sensível), time, situação e histórico de pagamentos da mensalidade, créditos de jogo, inscrições e presença em jogos, e, para menores, os dados do responsável legal.',
  },
  {
    titulo: '3. Para que usamos',
    texto:
      'Gerir a associação, emitir a carteirinha, cobrar a mensalidade, organizar os jogos e a presença, garantir a segurança e atender emergências (por isso pedimos o contato de emergência e as condições médicas) e cumprir obrigações legais.',
  },
  {
    titulo: '4. Quem pode ver seus dados',
    texto:
      'Qualquer pessoa que ler o QR Code da sua carteirinha vê seu nome, foto, time e a situação da mensalidade (é assim que parceiros e a organização validam a carteirinha). Associados logados veem nome e foto dos membros dos times. Endereço, contato de emergência e condições médicas ficam restritos à diretoria. A tesouraria e a organização veem apenas o que precisam para cobrança e para os jogos. Usamos a infraestrutura do Google Firebase para guardar os dados.',
  },
  {
    titulo: '5. Por quanto tempo guardamos',
    texto:
      'Enquanto você for associado e, depois, pelo prazo necessário para cumprir obrigações legais e defender direitos da associação. Os registros financeiros e de aceite do termo são mantidos para comprovação.',
  },
  {
    titulo: '6. Seus direitos',
    texto:
      'Você pode pedir à diretoria da AACN a confirmação do tratamento, o acesso, a correção, a anonimização ou eliminação (quando cabível), a portabilidade e a revogação do consentimento, conforme o art. 18 da LGPD. Você pode corrigir a maior parte dos dados direto em Meus dados.',
  },
  {
    titulo: '7. Segurança e atualizações',
    texto:
      'Adotamos medidas técnicas para proteger os dados, como controle de acesso por cargo e conexão segura. Esta política pode ser atualizada; quando houver mudança relevante, pediremos novo aceite.',
  },
]
