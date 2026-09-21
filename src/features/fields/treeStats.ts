import {
  collection,
  doc,
  getDocs,
  increment,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'

/** Aktif ağaç sayısı ve çeşit sayaçlarını atomik günceller. */
export async function adjustFieldTreeStats(
  farmId: string,
  fieldId: string,
  deltaActive: number,
  speciesDeltas?: ReadonlyArray<{ species: string; delta: number }>,
): Promise<void> {
  if (!deltaActive && (!speciesDeltas || speciesDeltas.length === 0)) return

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedAtIso: new Date().toISOString(),
  }
  if (deltaActive) {
    payload.activeTreeCount = increment(deltaActive)
  }
  for (const { species, delta } of speciesDeltas ?? []) {
    const key = species.trim()
    if (!key || !delta) continue
    payload[`speciesCounts.${key}`] = increment(delta)
  }
  await updateDoc(doc(db, 'farms', farmId, 'fields', fieldId), payload)
}

/** Eksik sayaçları tarayarak Field dokümanına yazar (tek seferlik / geri uyum). */
export async function recomputeFieldTreeStats(
  farmId: string,
  fieldId: string,
): Promise<{ activeTreeCount: number; speciesCounts: Record<string, number> }> {
  const snap = await getDocs(
    collection(db, 'farms', farmId, 'fields', fieldId, 'trees'),
  )
  let activeTreeCount = 0
  const speciesCounts: Record<string, number> = {}
  for (const d of snap.docs) {
    const data = d.data()
    if (String(data.status ?? 'active') !== 'active') continue
    activeTreeCount += 1
    const species = String(data.species ?? '').trim()
    if (!species) continue
    speciesCounts[species] = (speciesCounts[species] ?? 0) + 1
  }
  const now = new Date().toISOString()
  await updateDoc(doc(db, 'farms', farmId, 'fields', fieldId), {
    activeTreeCount,
    speciesCounts,
    updatedAt: serverTimestamp(),
    updatedAtIso: now,
  })
  return { activeTreeCount, speciesCounts }
}

/** activeTreeCount eksik tarlaları doldurur. */
export async function backfillMissingTreeStats(
  farmId: string,
  fields: { id: string; activeTreeCount?: number }[],
): Promise<void> {
  const missing = fields.filter((f) => f.activeTreeCount === undefined)
  if (missing.length === 0) return
  await Promise.all(
    missing.map((f) => recomputeFieldTreeStats(farmId, f.id)),
  )
}
