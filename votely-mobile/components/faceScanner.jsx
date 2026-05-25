import { useEffect, useMemo, useRef, useState } from 'react'
import { generateEmbedding } from '../lib/api'

const STEPS = [
  { id: 'center', label: 'Hadapkan wajah ke tengah', helper: 'Pastikan wajah terlihat jelas.' },
  { id: 'left', label: 'Geser wajah ke kiri', helper: 'Gerakkan kepala sedikit ke kiri layar.' },
  { id: 'right', label: 'Geser wajah ke kanan', helper: 'Gerakkan kepala sedikit ke kanan layar.' },
  { id: 'final', label: 'Kembali ke tengah', helper: 'Tahan sebentar untuk mengambil frame verifikasi.' },
]

function centerX(face) {
  return face.x + face.w / 2
}

function satisfied(step, face, baseline) {
  if (step === 'center') return true
  if (baseline === null) return false
  const threshold = Math.max(face.w * 0.18, 24)
  const current = centerX(face)
  if (step === 'left') return current < baseline - threshold
  if (step === 'right') return current > baseline + threshold
  return Math.abs(current - baseline) <= Math.max(face.w * 0.14, 20)
}

function FaceScanner({ title, description, onCapture, onCancel, busy, confirmLabel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const checkingRef = useRef(false)
  const stableRef = useRef(0)
  const finalFrameRef = useRef('')
  const [error, setError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [baseline, setBaseline] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [status, setStatus] = useState('')
  const [complete, setComplete] = useState(false)
  const currentStep = useMemo(() => STEPS[Math.min(stepIndex, STEPS.length - 1)], [stepIndex])

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
    if (!cameraReady || complete || error) return undefined

    const interval = setInterval(async () => {
      if (checkingRef.current) return
      const image = captureFrame()
      if (!image) return

      checkingRef.current = true
      try {
        const result = await generateEmbedding(image)
        const face = result?.face_location
        if (!face) {
          stableRef.current = 0
          setStatus('Wajah belum terdeteksi')
          checkingRef.current = false
          return
        }

        if (stepIndex === 0 && baseline === null) setBaseline(centerX(face))

        if (satisfied(currentStep.id, face, baseline ?? centerX(face))) {
          stableRef.current += 1
          setStatus('Bagus, tahan sebentar...')
        } else {
          stableRef.current = 0
          setStatus(currentStep.helper)
        }

        if (stableRef.current >= 2) {
          stableRef.current = 0
          if (stepIndex < STEPS.length - 1) {
            setStepIndex((value) => value + 1)
          } else {
            finalFrameRef.current = image
            setComplete(true)
            setStatus('Liveness terverifikasi')
            streamRef.current?.getTracks().forEach((track) => track.stop())
          }
        }
      } catch (err) {
        stableRef.current = 0
        setStatus(err?.message || 'Wajah belum terdeteksi')
      } finally {
        checkingRef.current = false
      }
    }, 800)

    return () => clearInterval(interval)
  }, [baseline, cameraReady, complete, currentStep, error, stepIndex])

  const handleSubmit = () => {
    if (!finalFrameRef.current) return
    onCapture(finalFrameRef.current)
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
          {cameraReady && (
            <div className='absolute inset-x-3 bottom-3 rounded-2xl bg-black/70 p-3 text-center text-white'>
              <p className='text-sm font-semibold'>{complete ? 'Siap diverifikasi' : currentStep.label}</p>
              <p className='text-xs text-white/70'>{status || currentStep.helper}</p>
              <div className='mt-3 grid grid-cols-4 gap-1'>
                {STEPS.map((step, index) => (
                  <div key={step.id} className={`h-1.5 rounded-full ${index <= stepIndex ? 'bg-teal-400' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className='grid grid-cols-2 gap-3'>
        <button type='button' onClick={onCancel} className='btn-secondary rounded-xl py-3 text-sm font-semibold' disabled={busy}>
          Batal
        </button>
        <button type='button' onClick={handleSubmit} className='btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-60' disabled={busy || Boolean(error) || !complete}>
          {busy ? 'Memproses...' : complete ? (confirmLabel || 'Gunakan Foto') : 'Ikuti Instruksi'}
        </button>
      </div>
    </div>
  )
}

export default FaceScanner
