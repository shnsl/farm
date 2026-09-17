import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { updateFieldMapImage } from './api'
import { compressFieldMapImage } from './compressImage'
import { IconZoomIn, IconZoomOut, IconZoomReset } from '../../components/Icons'
import { confirmDelete } from '../../lib/confirmDelete'

type FieldMapImagePanelProps = {
  farmId: string
  fieldId: string
  mapImageDataUrl?: string
  mapFileName?: string
  mapUpdatedAt?: string
  onSaved?: () => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.35

export function FieldMapImagePanel({
  farmId,
  fieldId,
  mapImageDataUrl,
  mapFileName,
  mapUpdatedAt,
  onSaved,
}: FieldMapImagePanelProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  useEffect(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [mapImageDataUrl])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !mapImageDataUrl) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))
        if (next <= MIN_ZOOM) setOffset({ x: 0, y: 0 })
        return next
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [mapImageDataUrl])

  async function onFileChange(file: File | null) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const { dataUrl, fileName } = await compressFieldMapImage(file)
      await updateFieldMapImage(farmId, fieldId, {
        mapImageDataUrl: dataUrl,
        mapFileName: fileName,
      })
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız')
    } finally {
      setBusy(false)
    }
  }

  async function clearImage() {
    if (
      !confirmDelete(
        'Harita fotoğrafı kaldırılsın mı? Bu işlem geri alınamaz.',
      )
    ) {
      return
    }
    setError(null)
    setBusy(true)
    try {
      await updateFieldMapImage(farmId, fieldId, { mapImageDataUrl: null })
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setBusy(false)
    }
  }

  function clampZoom(value: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
  }

  function zoomBy(delta: number) {
    setZoom((z) => {
      const next = clampZoom(z + delta)
      if (next <= MIN_ZOOM) setOffset({ x: 0, y: 0 })
      return next
    })
  }

  function resetView() {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!mapImageDataUrl || zoom <= MIN_ZOOM) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    setOffset({
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    })
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  return (
    <div className="stack field-map-panel">
      <p className="muted small">
        Tarlanın uydu / fotoğraf görüntüsünü JPEG veya PNG olarak yükle.
        Fotoğrafları kuzey üstte olacak şekilde çek.
      </p>

      <label className="btn btn-secondary field-map-file-btn">
        {busy ? 'Yükleniyor…' : mapImageDataUrl ? 'Fotoğrafı değiştir' : 'JPEG / PNG yükle'}
        <input
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          disabled={busy}
          hidden
          onChange={(e) => {
            void onFileChange(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </label>

      {mapImageDataUrl ? (
        <>
          <div
            ref={viewportRef}
            className="field-map-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="img"
            aria-label="Tarla harita fotoğrafı"
          >
            <div className="field-map-north" title="Kuzey yukarı">
              <span className="field-map-north-arrow" aria-hidden>
                ↑
              </span>
              <span>Kuzey</span>
            </div>
            <div
              className="field-map-stage"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            >
              <img src={mapImageDataUrl} alt={mapFileName || 'Tarla haritası'} draggable={false} />
            </div>
          </div>

          <div className="field-map-zoom-bar" role="group" aria-label="Harita zoom">
            <button
              type="button"
              className="btn btn-icon field-map-zoom-btn field-map-zoom-out"
              disabled={busy || zoom <= MIN_ZOOM}
              onClick={() => zoomBy(-ZOOM_STEP)}
              title="Uzaklaştır"
              aria-label="Uzaklaştır"
            >
              <IconZoomOut />
            </button>
            <button
              type="button"
              className="btn btn-icon field-map-zoom-btn field-map-zoom-in"
              disabled={busy || zoom >= MAX_ZOOM}
              onClick={() => zoomBy(ZOOM_STEP)}
              title="Yakınlaştır"
              aria-label="Yakınlaştır"
            >
              <IconZoomIn />
            </button>
            <button
              type="button"
              className="btn btn-icon field-map-zoom-btn"
              disabled={busy || (zoom === 1 && offset.x === 0 && offset.y === 0)}
              onClick={resetView}
              title="Görünümü sıfırla"
              aria-label="Görünümü sıfırla"
            >
              <IconZoomReset />
            </button>
            <span className="muted small field-map-zoom-label">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="field-map-summary stack">
            <dl className="kv">
              <dt>Dosya</dt>
              <dd>{mapFileName || 'tarla.jpg'}</dd>
              {mapUpdatedAt && (
                <>
                  <dt>Güncelleme</dt>
                  <dd>{mapUpdatedAt.slice(0, 16).replace('T', ' ')}</dd>
                </>
              )}
            </dl>
            <p className="muted small">
              Yakınken sürükleyerek gezinebilirsin. Tekerlek ile de zoom yapılır.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void clearImage()}
            >
              Fotoğrafı kaldır
            </button>
          </div>
        </>
      ) : (
        <div className="field-map-empty stack">
          <p className="muted">Henüz harita fotoğrafı yok.</p>
          <p className="muted small">
            Uydu görüntüsünden ekran görüntüsü alıp yükleyebilirsin. Yön: kuzey yukarı.
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
