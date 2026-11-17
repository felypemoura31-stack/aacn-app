import { describe, expect, it } from 'vitest'
import { cpfValido, formatarCpf, soDigitos } from './cadastro'

describe('CPF', () => {
  it('aceita CPF válido, com ou sem pontuação', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('52998224725')).toBe(true)
  })
  it('recusa dígito verificador errado, tamanho errado e dígitos repetidos', () => {
    expect(cpfValido('529.982.247-24')).toBe(false)
    expect(cpfValido('1234567890')).toBe(false)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido(undefined)).toBe(false)
  })
  it('formata enquanto digita', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25')
    expect(formatarCpf('5299')).toBe('529.9')
    expect(soDigitos('529.982.247-25')).toBe('52998224725')
  })
})
