import { apiFetch } from './api'

const ESP32_CAMERA_URL_KEY = 'votely_esp32_camera_url'

function normalizeCameraUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '')
  if (!trimmed) throw new Error('IP atau URL ESP32-CAM wajib diisi.')

  let url
  try {
    url = new URL(trimmed)
  } catch {
    url = new URL(`http://${trimmed}`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('URL ESP32-CAM harus memakai http:// atau https://.')
  }

  const isBaseUrl = url.pathname === '/' && !url.search
  return isBaseUrl ? url.origin : url.toString()
}

export function getSavedEsp32CameraUrl() {
  try {
    return localStorage.getItem(ESP32_CAMERA_URL_KEY) || ''
  } catch {
    return ''
  }
}

export function saveEsp32CameraUrl(value) {
  try {
    localStorage.setItem(ESP32_CAMERA_URL_KEY, normalizeCameraUrl(value))
  } catch {
    // localStorage can be unavailable in private or locked-down contexts.
  }
}

export function isEsp32CameraUrlValid(value) {
  try {
    normalizeCameraUrl(value)
    return true
  } catch {
    return false
  }
}

export async function testEsp32WifiCamera(cameraUrl) {
  const normalizedUrl = normalizeCameraUrl(cameraUrl)

  try {
    const data = await apiFetch('/api/iot-camera/health', {
      method: 'POST',
      body: JSON.stringify({ cameraUrl: normalizedUrl }),
    })

    if (data?.ok === false) throw new Error('ESP32-CAM belum siap.')

    saveEsp32CameraUrl(normalizedUrl)
    return {
      baseUrl: normalizedUrl,
      device: data?.device || 'Votely-CAM',
      ip: data?.ip || data?.captureUrl || normalizedUrl.replace(/^https?:\/\//, ''),
    }
  } catch (err) {
    throw new Error(err?.message || 'ESP32-CAM tidak merespons. Periksa IP dan jaringan WiFi.')
  }
}

export async function captureEsp32WifiFrame(cameraUrl) {
  const normalizedUrl = normalizeCameraUrl(cameraUrl)

  try {
    const data = await apiFetch('/api/iot-camera/capture', {
      method: 'POST',
      body: JSON.stringify({ cameraUrl: normalizedUrl }),
    })

    if (!data?.image) {
      throw new Error('ESP32-CAM tidak mengirim JPEG valid.')
    }

    return data.image
  } catch (err) {
    throw new Error(err?.message || 'Capture ESP32-CAM timeout. Coba ulangi.')
  }
}

export async function getEsp32WifiPreviewFrame(cameraUrl) {
  const normalizedUrl = normalizeCameraUrl(cameraUrl)

  try {
    const data = await apiFetch('/api/iot-camera/preview', {
      method: 'POST',
      body: JSON.stringify({ cameraUrl: normalizedUrl }),
    })

    if (!data?.image) {
      throw new Error('ESP32-CAM tidak mengirim preview valid.')
    }

    return data.image
  } catch (err) {
    throw new Error(err?.message || 'Preview ESP32-CAM terputus.')
  }
}

export function createBrowserFrameCapture(video) {
  if (!video) return ''
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 480
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}
