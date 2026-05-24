import { useState } from 'react'
import { login } from '../lib/api'

function LoginPage({ onLoggedIn }) {
  const [nik, setNik] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!nik || !password) {
        throw new Error('NIK dan password wajib diisi.')
      }
      const result = await login(nik, password)
      await onLoggedIn?.(result.data)
    } catch (err) {
      setError(err.message || 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <form onSubmit={handleLogin} className="login-card" noValidate>
        <img src="/VotelyNew_White.png" className="login-brand" alt="Votely" />
        <section className="auth-panel">
          <div className="auth-heading">
            <img src="/userlogo.png" className="auth-avatar" alt="" />
            <p className="eyebrow">Mobile Voting</p>
            <h1>Masuk ke Votely</h1>
            <p>Gunakan akun pemilih untuk verifikasi wajah dan mencoblos secara aman.</p>
          </div>

          <div className="form-stack">
            <label className="field">
              <span>NIK</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Masukkan 16 digit NIK"
                value={nik}
                onChange={(event) => setNik(event.target.value)}
                disabled={loading}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
              />
            </label>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" disabled={loading} className="primary-button">
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>

          <div className="auth-note">
            <span>Butuh bantuan login?</span>
            <strong>Hubungi petugas TPS</strong>
          </div>
        </section>
      </form>
    </main>
  )
}

export default LoginPage
