/** Silme işlemleri için ortak onay. */
export function confirmDelete(message: string): boolean {
  return window.confirm(message)
}
