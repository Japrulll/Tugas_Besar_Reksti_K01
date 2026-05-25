"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Camera } from 'lucide-react'

interface FaceScannerProps {
  onSuccess?: () => void
  onSuccessWithEmbedding?: (embedding: number[]) => void
  onSkip?: () => void
  title?: string
  description?: string
  nik?: string
  mode?: 'verify' | 'register'
}

const SNAPSHOT_COUNT = 3

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
  const snapshotsRef = useRef<string[]>([])
  const latestEmbeddingRef = useRef<number[] | null>(null)
  const [scanned, setScanned] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

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
    if (!cameraReady || !capturing || scanned) return

    const interval = setInterval(async () => {
      if (verifyingRef.current) return
      const imageData = captureFrame()
      if (!imageData) return

      verifyingRef.current = true
      try {
        const response = await fetch('/api/face-verify/generate-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData })
        })
        const result = await response.json()

        if (!response.ok || !result.success) {
          const message = result.error || 'Wajah belum terdeteksi'
          setStatusMessage(message.toLowerCase().includes('face') ? 'Wajah belum terdeteksi' : message)
          verifyingRef.current = false
          return
        }

        if (!result.face_detected || !result.face_location) {
          setStatusMessage('Wajah belum terdeteksi')
          verifyingRef.current = false
          return
        }

        latestEmbeddingRef.current = Array.isArray(result.embedding) ? result.embedding : latestEmbeddingRef.current
        snapshotsRef.current = [...snapshotsRef.current, imageData].slice(0, SNAPSHOT_COUNT)
        setStatusMessage('Memverifikasi wajah...')

        if (snapshotsRef.current.length < SNAPSHOT_COUNT) {
          verifyingRef.current = false
          return
        }

        if (mode === 'verify') {
          const verifyResponse = await fetch('/api/face-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: snapshotsRef.current, nik })
          })
          const verifyResult = await verifyResponse.json()
          if (!verifyResponse.ok) {
            setStatusMessage(verifyResult.error || 'Verifikasi wajah gagal')
            snapshotsRef.current = []
            setCapturing(false)
            verifyingRef.current = false
            return
          }
          if (!verifyResult.face_detected || Number(verifyResult.similarity || 0) < 0.55) {
            setStatusMessage('Wajah tidak cocok, coba posisikan ulang')
            snapshotsRef.current = []
            setCapturing(false)
            verifyingRef.current = false
            return
          }
        }

        stopCamera()
        setStatusMessage('3 snapshot terverifikasi')
        setScanned(true)
        setScanning(false)
        setCapturing(false)

        if (mode === 'register' && latestEmbeddingRef.current && onSuccessWithEmbedding) {
          onSuccessWithEmbedding(latestEmbeddingRef.current)
        } else if (onSuccess) {
          onSuccess()
        }
      } catch (err) {
        console.error('Face scan error:', err)
        setStatusMessage('Verifikasi wajah gagal, mencoba lagi...')
      } finally {
        verifyingRef.current = false
      }
    }, 700)

    return () => clearInterval(interval)
  }, [cameraReady, capturing, mode, nik, onSuccess, onSuccessWithEmbedding, scanned])

  const handleStartScan = () => {
    setError('')
    setStatusMessage('')
    snapshotsRef.current = []
    latestEmbeddingRef.current = null
    setScanning(true)
  }

  const handleStartVerification = () => {
    setStatusMessage('Memverifikasi wajah...')
    snapshotsRef.current = []
    setCapturing(true)
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
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {statusMessage && <p className="text-center text-sm text-muted-foreground">{statusMessage}</p>}
            <Button onClick={handleStartVerification} className="w-full bg-primary hover:bg-primary/90 h-10" disabled={!cameraReady || capturing}>
              {capturing ? 'Memverifikasi...' : 'Mulai Verifikasi Wajah'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button onClick={handleStartScan} className="w-full bg-primary hover:bg-primary/90 h-10">
              {mode === 'register' ? 'Mulai Registrasi Wajah' : 'Mulai Verifikasi Wajah'}
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
