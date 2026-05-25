const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export function getStoredToken() {
  return localStorage.getItem('votely_token')
}

export function setStoredToken(token) {
  if (token) localStorage.setItem('votely_token', token)
}

export function clearStoredToken() {
  localStorage.removeItem('votely_token')
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`)
  }
  return data
}

export async function login(nik, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nik, password }),
  })
  if (data?.token) setStoredToken(data.token)
  return data
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    clearStoredToken()
  }
}

export async function getMe() {
  return apiFetch('/api/auth/me')
}

export async function validateCredentials(nik, password) {
  return apiFetch('/api/auth/validate-credentials', {
    method: 'POST',
    body: JSON.stringify({ nik, password }),
  })
}

export async function registerWithFace(payload) {
  return apiFetch('/api/auth/register-with-face', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function generateEmbedding(image) {
  return apiFetch('/api/face-verify/generate-embedding', {
    method: 'POST',
    body: JSON.stringify({ image }),
  })
}

export async function verifyFace(image, { nik, electionId } = {}) {
  return apiFetch('/api/face-verify', {
    method: 'POST',
    body: JSON.stringify({ image, nik, electionId }),
  })
}

export async function getElectionsForUser() {
  return apiFetch('/api/elections?forUser=true')
}

export async function getElectionDetail(electionId, includeResults = true) {
  const suffix = includeResults ? '?includeResults=true' : ''
  return apiFetch(`/api/elections/${electionId}${suffix}`)
}

export async function checkVote(electionId) {
  return apiFetch(`/api/vote/check?electionId=${encodeURIComponent(electionId)}`)
}

export async function castVote({ electionId, candidateId, voteToken }) {
  return apiFetch('/api/vote/cast', {
    method: 'POST',
    body: JSON.stringify({ electionId, candidateId, voteToken }),
  })
}

export async function getAdminElections() {
  return apiFetch('/api/admin/elections')
}

export async function createAdminElection(payload) {
  return apiFetch('/api/admin/elections/create-and-deploy', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
