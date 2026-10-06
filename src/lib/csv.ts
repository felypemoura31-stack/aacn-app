type Celula = string | number | null | undefined

function escapar(v: Celula) {
  let s = v == null ? '' : String(v)
  // evita "injeção de fórmula" quando a planilha é aberta no Excel/Sheets
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Baixa uma planilha CSV (separador ";" e BOM, para abrir certo no Excel em português). */
export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const conteudo = '﻿' + [cabecalho, ...linhas].map((l) => l.map(escapar).join(';')).join('\r\n')
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
