import { useEffect, useRef, useState } from 'react'

function FaceScanner({ title, description, onCapture, onCancel, busy, confirmLabel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
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

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = canvas.toDataURL('image/jpeg', 0.9)
    setPreview(imageData)
  }

  const handleSubmit = () => {
    if (!preview) return
    onCapture(preview)
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
          {preview ? (
            <img src={preview} alt='Preview' className='w-full h-full object-cover' />
          ) : (
            <video ref={videoRef} autoPlay playsInline className='w-full h-full object-cover' />
          )}
          <div className='absolute inset-0 border-2 border-white/20 rounded-2xl pointer-events-none' />
        </div>
      )}

      <div className='grid grid-cols-2 gap-3'>
        <button
          type='button'
          onClick={preview ? () => setPreview('') : handleCapture}
          className='btn-secondary rounded-xl py-3 text-sm font-semibold'
          disabled={busy || Boolean(error)}
        >
          {preview ? 'Ulangi' : 'Ambil Foto'}
        </button>
        <button
          type='button'
          onClick={preview ? handleSubmit : onCancel}
          className='btn-primary rounded-xl py-3 text-sm font-semibold'
          disabled={busy || Boolean(error)}
        >
          {preview ? (confirmLabel || 'Gunakan Foto') : 'Batal'}
        </button>
      </div>
    </div>
  )
}

export default FaceScanner
