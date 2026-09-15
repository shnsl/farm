import { z } from 'zod'

const CELL_PATTERN = /^[A-Z]+-\d+$/

export const cellSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(CELL_PATTERN, 'Hücre formatı A-12 gibi olmalıdır')

export function rowIndexToLetter(index: number): string {
  if (index < 0) {
    throw new Error('Satır indeksi negatif olamaz')
  }
  let n = index
  let result = ''
  do {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return result
}

export function letterToRowIndex(letter: string): number {
  const upper = letter.toUpperCase()
  let result = 0
  for (let i = 0; i < upper.length; i += 1) {
    const code = upper.charCodeAt(i)
    if (code < 65 || code > 90) {
      throw new Error(`Geçersiz satır harfi: ${letter}`)
    }
    result = result * 26 + (code - 64)
  }
  return result - 1
}

export function formatCell(row: string, col: number): string {
  return `${row.toUpperCase()}-${col}`
}

export function parseCell(cell: string): { row: string; col: number } {
  const normalized = cellSchema.parse(cell)
  const [row, colRaw] = normalized.split('-')
  const col = Number(colRaw)
  if (!Number.isInteger(col) || col < 1) {
    throw new Error('Sütun numarası 1 veya daha büyük olmalıdır')
  }
  return { row, col }
}

export function buildRowLetters(rowCount: number): string[] {
  return Array.from({ length: rowCount }, (_, i) => rowIndexToLetter(i))
}
