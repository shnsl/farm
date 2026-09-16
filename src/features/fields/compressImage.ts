const MAX_EDGE = 1600
const MAX_BYTES = 900_000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Görsel okunamadı'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Görsel sıkıştırılamadı'))
        else resolve(blob)
      },
      'image/jpeg',
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Görsel okunamadı'))
    reader.readAsDataURL(blob)
  })
}

/** JPEG/PNG dosyasını Firestore’a sığacak şekilde sıkıştırır. */
export async function compressFieldMapImage(file: File): Promise<{
  dataUrl: string
  fileName: string
}> {
  const type = file.type.toLowerCase()
  if (type !== 'image/jpeg' && type !== 'image/png' && type !== 'image/jpg') {
    throw new Error('Yalnızca JPEG veya PNG yükleyebilirsin')
  }

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Görsel işlenemedi')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  let quality = 0.82
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > MAX_BYTES && quality > 0.45) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size > MAX_BYTES) {
    throw new Error('Fotoğraf çok büyük; daha küçük bir görsel dene')
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'tarla'
  return {
    dataUrl: await blobToDataUrl(blob),
    fileName: `${base}.jpg`,
  }
}
