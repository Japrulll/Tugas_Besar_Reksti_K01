import { useEffect, useRef, useState } from 'react'
import { generateEmbedding } from '../lib/api'
import {
  captureEsp32WifiFrame,
  createBrowserFrameCapture,
  getEsp32WifiPreviewFrame,
  getSavedEsp32CameraUrl,
  isEsp32CameraUrlValid,
  testEsp32WifiCamera,
} from '../lib/cameraProviders'

const SNAPSHOT_COUNT = 3
const CAMERA_BROWSER = 'browser'
const CAMERA_ESP32_WIFI = 'esp32-wifi'
const PREVIEW_INTERVAL_MS = 600
const MAX_PREVIEW_FAILURES = 3

function FaceScanner({ title, description, onCapture, onCancel, busy, confirmLabel }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const checkingRef = useRef(false)
  const previewLoadingRef = useRef(false)
  const previewFailuresRef = useRef(0)
  const snapshotsRef = useRef([])
  const [error, setError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [cameraSource, setCameraSource] = useState(CAMERA_ESP32_WIFI)
  const [esp32Url, setEsp32Url] = useState(() => getSavedEsp32CameraUrl())
  const [esp32Status, setEsp32Status] = useState('')
  const [esp32Connected, setEsp32Connected] = useState(false)
  const [testingEsp32, setTestingEsp32] = useState(false)
  const [previewImage, setPreviewImage] = useState('')
  const [previewError, setPreviewError] = useState('')

  const stopBrowserCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (cameraSource !== CAMERA_BROWSER) {
      stopBrowserCamera()
      setCameraReady(false)
      return undefined
    }

    let active = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream
          setTimeout(() => {
            if (active) setCameraReady(true)
          }, 500)
        }
      } catch (err) {
        setError('Tidak bisa mengakses kamera. Periksa izin kamera Anda.')
      }
    }

    startCamera()

    return () => {
      active = false
      stopBrowserCamera()
    }
  }, [cameraSource])

  const currentCameraReady = cameraSource === CAMERA_ESP32_WIFI ? esp32Connected : cameraReady

  const captureFrame = async () => {
    if (cameraSource === CAMERA_ESP32_WIFI) {
      return captureEsp32WifiFrame(esp32Url)
    }
    return createBrowserFrameCapture(videoRef.current)
  }

  const handleTestEsp32 = async () => {
    setTestingEsp32(true)
    setError('')
    setEsp32Status('Menghubungkan ESP32-CAM...')
    setEsp32Connected(false)

    try {
      const result = await testEsp32WifiCamera(esp32Url)
      setEsp32Url(result.baseUrl)
      setEsp32Connected(true)
      setPreviewImage('')
      setPreviewError('')
      previewFailuresRef.current = 0
      setEsp32Status(`Terhubung ke ${result.device} (${result.ip})`)
    } catch (err) {
      setEsp32Status('Tidak terjangkau')
      setError(err?.message || 'Tidak bisa terhubung ke ESP32-CAM.')
    } finally {
      setTestingEsp32(false)
    }
  }

  const selectCameraSource = (source) => {
    setCapturing(false)
    snapshotsRef.current = []
    setError('')
    setPreviewError('')
    setCameraSource(source)
  }

  useEffect(() => {
    if (cameraSource !== CAMERA_ESP32_WIFI || !esp32Connected || error) {
      previewLoadingRef.current = false
      if (cameraSource !== CAMERA_ESP32_WIFI) setPreviewImage('')
      return undefined
    }

    let active = true

    const loadPreviewFrame = async () => {
      if (!active || previewLoadingRef.current) return

      previewLoadingRef.current = true
      try {
        const image = await getEsp32WifiPreviewFrame(esp32Url)
        if (!active) return
        previewFailuresRef.current = 0
        setPreviewImage(image)
        setPreviewError('')
      } catch (err) {
        if (!active) return
        previewFailuresRef.current += 1
        if (previewFailuresRef.current >= MAX_PREVIEW_FAILURES) {
          setPreviewError(err?.message || 'Preview terputus, tes koneksi ulang.')
        }
      } finally {
        previewLoadingRef.current = false
      }
    }

    loadPreviewFrame()
    const interval = window.setInterval(loadPreviewFrame, PREVIEW_INTERVAL_MS)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [cameraSource, error, esp32Connected, esp32Url])

  useEffect(() => {
    if (!currentCameraReady || !capturing || busy || error) return undefined

    const interval = setInterval(async () => {
      if (checkingRef.current) return

      checkingRef.current = true
      try {
        const image = await captureFrame()
        if (!image) return

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
        const message = err?.message || ''
        if (cameraSource === CAMERA_ESP32_WIFI) {
          setError(message || 'Capture ESP32-CAM gagal. Periksa koneksi WiFi.')
          setEsp32Status('Capture gagal')
          setCapturing(false)
        }
      } finally {
        checkingRef.current = false
      }
    }, 800)

    return () => clearInterval(interval)
  }, [busy, cameraSource, currentCameraReady, capturing, error, esp32Url, onCapture])

  const startVerification = () => {
    snapshotsRef.current = []
    setError('')
    setCapturing(true)
  }

  return (
    <div className='glass-panel rounded-2xl border-glow p-5 space-y-4'>
      <div className='space-y-1'>
        <h2 className='text-lg font-bold text-slate-800'>{title}</h2>
        <p className='text-sm text-slate-500'>{description}</p>
      </div>

      <div className='grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1'>
        <button
          type='button'
          onClick={() => selectCameraSource(CAMERA_ESP32_WIFI)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            cameraSource === CAMERA_ESP32_WIFI ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
          }`}
          disabled={busy || capturing}
        >
          ESP32-CAM WiFi
        </button>
        <button
          type='button'
          onClick={() => selectCameraSource(CAMERA_BROWSER)}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            cameraSource === CAMERA_BROWSER ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'
          }`}
          disabled={busy || capturing}
        >
          Kamera Perangkat
        </button>
      </div>

      {cameraSource === CAMERA_ESP32_WIFI && (
        <div className='space-y-3 rounded-2xl border border-slate-200 bg-white/70 p-3'>
          <label className='block space-y-2'>
            <span className='text-xs font-semibold text-slate-500'>IP / URL ESP32-CAM</span>
            <input
              type='text'
              value={esp32Url}
              onChange={(event) => {
                setEsp32Url(event.target.value)
                setEsp32Connected(false)
                setEsp32Status('')
                setPreviewImage('')
                setPreviewError('')
              }}
              placeholder='http://192.168.1.50'
              className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400'
              disabled={busy || capturing || testingEsp32}
            />
          </label>
          <button
            type='button'
            onClick={handleTestEsp32}
            className='btn-secondary w-full rounded-xl py-2 text-sm font-semibold disabled:opacity-60'
            disabled={busy || capturing || testingEsp32 || !isEsp32CameraUrlValid(esp32Url)}
          >
            {testingEsp32 ? 'Menguji Koneksi...' : esp32Connected ? 'Tes Ulang Koneksi' : 'Tes Koneksi'}
          </button>
          {esp32Status && (
            <p className={`text-xs font-semibold ${esp32Connected ? 'text-emerald-600' : 'text-slate-500'}`}>
              {esp32Status}
            </p>
          )}
        </div>
      )}

      {error ? (
        <div className='rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600'>
          {error}
        </div>
      ) : cameraSource === CAMERA_ESP32_WIFI ? (
        <div className='relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900/80 flex items-center justify-center text-center'>
          {previewImage ? (
            <img src={previewImage} alt='Preview ESP32-CAM' className='h-full w-full object-cover' />
          ) : (
            <div className='space-y-2 p-6'>
              <div className={`mx-auto h-3 w-3 rounded-full ${esp32Connected ? 'bg-emerald-400' : 'bg-amber-300'}`} />
              <p className='text-sm font-semibold text-white'>
                {esp32Connected ? 'Memuat preview...' : 'Hubungkan ESP32-CAM terlebih dahulu'}
              </p>
              <p className='text-xs text-white/70'>
                Pastikan HP dan ESP32-CAM berada di jaringan WiFi yang sama.
              </p>
            </div>
          )}
          {esp32Connected && (
            <div className='absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white'>
              {capturing ? 'Memverifikasi...' : 'Live ESP32-CAM'}
            </div>
          )}
          {previewError && (
            <div className='absolute inset-x-3 bottom-3 rounded-xl bg-red-500/90 px-3 py-2 text-xs font-semibold text-white'>
              {previewError}
            </div>
          )}
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
        <button type='button' onClick={startVerification} className='btn-primary rounded-xl py-3 text-sm font-semibold disabled:opacity-60' disabled={busy || capturing || Boolean(error) || !currentCameraReady}>
          {busy ? 'Memproses...' : capturing ? 'Memverifikasi...' : 'Mulai Verifikasi Wajah'}
        </button>
      </div>
    </div>
  )
}

export default FaceScanner
