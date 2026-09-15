/** Dikim tarihinden bugüne yaş metni (dinamik; saklanmaz). */
export function formatTreeAge(
  plantedAt: string | undefined | null,
  now: Date = new Date(),
): string | null {
  if (!plantedAt?.trim()) return null

  const planted = new Date(plantedAt.slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(planted.getTime())) return null
  if (planted > now) return 'Henüz dikilmedi'

  let years = now.getFullYear() - planted.getFullYear()
  let months = now.getMonth() - planted.getMonth()
  let days = now.getDate() - planted.getDate()

  if (days < 0) {
    months -= 1
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years <= 0 && months <= 0) {
    return '1 aydan az'
  }
  if (years <= 0) {
    return `${months} aylık`
  }
  if (months === 0) {
    return `${years} yaşında`
  }
  return `${years} yaş ${months} ay`
}
