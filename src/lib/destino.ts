/** Endereço interno para voltar depois de entrar/cadastrar (só caminhos do próprio app). */
export function destinoSalvo(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}
