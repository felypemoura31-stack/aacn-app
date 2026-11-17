import { describe, expect, it } from 'vitest'
import { linkDaRede, urlHttp } from './redes'

describe('links de redes sociais', () => {
  it('só aceita http e https (nunca javascript:)', () => {
    expect(urlHttp('javascript:alert(1)')).toBeNull()
    expect(urlHttp('data:text/html,x')).toBeNull()
    expect(urlHttp('https://exemplo.com/a')).toBe('https://exemplo.com/a')
  })
  it('acrescenta https:// quando falta', () => {
    expect(urlHttp('exemplo.com.br/time')).toBe('https://exemplo.com.br/time')
  })
  it('monta o link a partir de @usuario e rejeita lixo', () => {
    expect(linkDaRede('instagram', '@aacn')).toBe('https://instagram.com/aacn')
    expect(linkDaRede('instagram', 'javascript:alert(1)')).toBeNull()
    expect(linkDaRede('instagram', '')).toBeNull()
  })
})
