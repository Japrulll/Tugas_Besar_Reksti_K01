"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Camera, ScanFace } from 'lucide-react'

interface FaceScannerProps {
  onSuccess?: () => void
  onSuccessWithEmbedding?: (embedding: number[]) => void
  onSkip?: () => void
  title?: string
  description?: string
  nik?: string
  mode?: 'verify' | 'register'
}

type FaceLocation = {
  x: number
  y: number
  w: number
  h: number
}

type LivenessStep = {
  id: 'center' | 'left' | 'right' | 'final'
  label: string
  helper: string
}

const LIVENESS_STEPS: LivenessStep[] = [
  { id: 'center', label: 'Hadapkan wajah ke tengah', helper: 'Pastikan wajah terlihat jelas di dalam kamera.' },
  { id: 'left', label: 'Geser wajah ke kiri', helper: 'Gerakkan kepala sedikit ke sisi kiri layar.' },
  { id: 'right', label: 'Geser wajah ke kanan', helper: 'Gerakkan kepala sedikit ke sisi kanan layar.' },
  { id: 'final', label: 'Kembali ke tengah', helper: 'Tahan sebentar untuk verifikasi akhir.' },
]

function getFaceCenter(face: FaceLocation) {
  return face.x + face.w / 2
}

function isStepSatisfied(step: LivenessStep['id'], face: FaceLocation, baselineX: number | null) {
  if (step === 'center') return true
  if (baselineX === null) return false

  const currentX = getFaceCenter(face)
  const threshold = Math.max(face.w * 0.18, 28)
  if (step === 'left') return currentX < baselineX - threshold
  if (step === 'right') return currentX > baselineX + threshold
  return Math.abs(currentX - baselineX) <= Math.max(face.w * 0.14, 24)
}

export function FaceScanner({
  onSuccess,
  onSuccessWithEmbedding,
  onSkip,
  title = 'Face Verification',
  description = 'Ikuti instruksi liveness sebelum verifikasi wajah',
  nik,
  mode = 'verify'
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const verifyingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const stableCountRef = useRef(0)
  const [scanned, setScanned] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState('')
  const [similarity, setSimilarity] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [baselineX, setBaselineX] = useState<number | null>(null)
  const currentStep = useMemo(() => LIVENESS_STEPS[Math.min(stepIndex, LIVENESS_STEPS.length - 1)], [stepIndex])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
  }

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!video || !canvas || !context) return null

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height
    context.drawImage(video, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  useEffect(() => {
    if (!scanning) return

    let mounted = true

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })

        streamRef.current = stream
        if (videoRef.current && mounted) {
          videoRef.current.srcObject = stream
          setTimeout(() => {
            if (mounted) setCameraReady(true)
          }, 500)
        }
      } catch (err) {
        console.error('Camera access error:', err)
        if (mounted) {
          setError('Tidak bisa mengakses kamera. Periksa izin kamera Anda.')
          setScanning(false)
          setCameraReady(false)
        }
      }
    }

    startCamera()

    return () => {
      mounted = false
      stopCamera()
    }
  }, [scanning])

  useEffect(() => {
    if (!cameraReady || scanned) return

    const interval = setInterval(async () => {
      if (verifyingRef.current) return
      const imageData = captureFrame()
      if (!imageData) return

      verifyingRef.current = true
      try {
        const endpoint = mode === 'register' ? '/api/face-verify/generate-embedding' : '/api/face-verify'
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'register' ? { image: imageData } : { image: imageData, nik })
        })
        const result = await response.json()

        if (!response.ok || (mode === 'register' && !result.success)) {
          stableCountRef.current = 0
          const message = result.error || 'Wajah belum terdeteksi'
          setStatusMessage(message.toLowerCase().includes('face') ? 'Wajah belum terdeteksi' : message)
          verifyingRef.current = false
          return
        }

        if (!result.face_detected || !result.face_location) {
          stableCountRef.current = 0
          setStatusMessage('Wajah belum terdeteksi')
          verifyingRef.current = false
          return
        }

        const face = result.face_location as FaceLocation
        if (stepIndex === 0 && baselineX === null) setBaselineX(getFaceCenter(face))
        if (typeof result.similarity === 'number') setSimilarity(result.similarity)

        if (isStepSatisfied(currentStep.id, face, baselineX ?? getFaceCenter(face))) {
          stableCountRef.current += 1
          setStatusMessage('Bagus, tahan sebentar...')
        } else {
          stableCountRef.current = 0
          setStatusMessage(currentStep.helper)
        }

        if (stableCountRef.current >= 2) {
          stableCountRef.current = 0
          if (stepIndex < LIVENESS_STEPS.length - 1) {
            setStepIndex((current) => current + 1)
            verifyingRef.current = false
            return
          }

          if (mode === 'verify' && Number(result.similarity || 0) < 0.55) {
            setStatusMessage('Wajah tidak cocok, coba posisikan ulang')
            verifyingRef.current = false
            return
          }

          stopCamera()
          setStatusMessage('Liveness terverifikasi')
          setScanned(true)
          setScanning(false)

          if (mode === 'register' && result.embedding && onSuccessWithEmbedding) {
            onSuccessWithEmbedding(result.embedding)
          } else if (onSuccess) {
            onSuccess()
          }
        }
      } catch (err) {
        console.error('Face scan error:', err)
        stableCountRef.current = 0
        setStatusMessage('Verifikasi wajah gagal, mencoba lagi...')
      } finally {
        verifyingRef.current = false
      }
    }, 700)

    return () => clearInterval(interval)
  }, [baselineX, cameraReady, currentStep, mode, nik, onSuccess, onSuccessWithEmbedding, scanned, stepIndex])

  const handleStartScan = () => {
    setError('')
    setStatusMessage('')
    setSimilarity(null)
    setBaselineX(null)
    setStepIndex(0)
    stableCountRef.current = 0
    setScanning(true)
  }

  if (scanned) {
    return (
      <Card className="w-full">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {mode === 'register' ? 'Face Registered' : 'Face Verified'}
          </h3>
          <p className="text-sm text-muted-foreground">Liveness dan identitas wajah berhasil diverifikasi.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="border-b border-border bg-secondary/50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {scanning ? (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto mb-3" />
                    <p className="text-sm text-white">Menyalakan kamera...</p>
                  </div>
                </div>
              )}
              {cameraReady && (
                <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/75 px-4 py-3 text-center text-white">
                  <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold">
                    <ScanFace className="h-4 w-4 text-[#1FD7BE]" />
                    {currentStep.label}
                  </div>
                  <p className="text-xs text-white/75">{statusMessage || currentStep.helper}</p>
                  {similarity !== null && mode === 'verify' && (
                    <p className="mt-1 text-[11px] text-emerald-300">Match: {Math.round(similarity * 100)}%</p>
                  )}
                  <div className="mt-3 grid grid-cols-4 gap-1">
                    {LIVENESS_STEPS.map((step, index) => (
                      <div key={step.id} className={`h-1.5 rounded-full ${index <= stepIndex ? 'bg-[#1FD7BE]' : 'bg-white/20'}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleStartScan} className="w-full bg-primary hover:bg-primary/90 h-10">
              {mode === 'register' ? 'Start Face Registration' : 'Start Liveness Check'}
            </Button>
            {onSkip && (
              <Button onClick={onSkip} variant="outline" className="w-full h-10">
                Continue Without Verification
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
