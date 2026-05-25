import { useEffect, useRef, useState } from 'react'
import { generateEmbedding } from '../lib/api'

const SNAPSHOT_COUNT = 3

function FaceScanner({ title, description, onCapture, onCancel, busy, confirmLabel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const checkingRef = useRef(false)
  const snapshotsRef = useRef([])
  const [error, setError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setTimeout(() => setCameraReady(true), 500)
        }
      } catch (err) {
        setError('Tidak bisa mengakses kamera. Periksa izin kamera Anda.')
      }
    }

    startCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const captureFrame = () => {
    const video = videoRef.current
    if (!video) return ''
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  useEffect(() => {
    if (!cameraReady || !capturing || busy || error) return undefined

    const interval = setInterval(async () => {
      if (checkingRef.current) return
      const image = captureFrame()
      if (!image) return

      checkingRef.current = true
      try {
        const result = await generateEmbedding(image)
        const face = result?.face_location
        if (!face) {
          checkingRef.current = false
          return
        }

        snapshotsRef.current = [...snapshotsRef.current, image].slice(0, SNAPSHOT_COUNT)

        if (snapshotsRef.current.length >= SNAPSHOT_COUNT) {
          setCapturing(false)
          onCapture([...snapshotsRef.current])
        }
      } catch (err) {
        // Keep trying quietly until three valid face snapshots are collected.
      } finally {
        checkingRef.current = false
      }
    }, 800)

    return () => clearInterval(interval)
  }, [busy, cameraReady, capturing, error, onCapture])

  const startVerification = () => {
    snapshotsRef.current = []
    setCapturing(true)
  }

  return (
    <div className='glass-panel rounded-2xl border-glow p-5 space-y-4'>
      <div className='space-y-1'>
        <h2 className='text-lg font-bold text-slate-800'>{title}</h2>
        <p className='text-sm text-slate-500'>{description}</p>
      </div>

      {error ? (
        <div className='rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600'>
          {error}
        </div>
      ) : (
        <div className='relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900/80'>
          <video ref={videoRef} autoPlay playsInline muted className='w-full h-full object-cover scale-x-[-1]' />
          {!cameraReady && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white'>
              Menyalakan kamera...
            </div>
          )}
        </div>
      )}

      <div className='grid grid-cols-2 gap-3'>
        <button type='button' onClick={onCancel} className='btn-secondary rounded-xl py-3 text-sm font-semibold' disabled={busy}>
          Batal
        </button>
        <button type='button' onClick={startVerification} className='btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-60' disabled={busy || capturing || Boolean(error) || !cameraReady}>
          {busy ? 'Memproses...' : capturing ? 'Memverifikasi...' : 'Mulai Verifikasi Wajah'}
        </button>
      </div>
    </div>
  )
}

export default FaceScanner
