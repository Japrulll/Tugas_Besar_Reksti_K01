import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { faceLogin } from '../lib/api'
import { useAuth } from '../App.jsx'

function LoginPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [nik, setNik] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const completeLogin = async () => {
    const data = await faceLogin(nik)
    await refreshUser()
    const role = data?.data?.role
    if (role !== 'WARGA') {
      throw new Error('Mobile hanya untuk pemilih.')
    }
    navigate('/dashboard', { replace: true })
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError('')

    if (!nik) {
      setError('NIK wajib diisi.')
      return
    }

    setLoading(true)
    try {
      await completeLogin()
    } catch (err) {
      setError(err?.message || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gradient flex flex-col justify-center px-6 py-10'>
      <div className='max-w-md w-full mx-auto space-y-6'>
        <div className='text-center text-white space-y-2'>
          <img src='/VotelyNew_White.png' alt='Votely' className='h-9 mx-auto' />
          <p className='text-sm text-white/70'>Platform voting aman berbasis blockchain</p>
        </div>

        <div className='glass-panel rounded-3xl border-glow p-6 space-y-5'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold text-slate-800'>Masuk Pemilih</h1>
            <p className='text-sm text-slate-500'>Masukkan NIK yang sudah didaftarkan admin.</p>
          </div>

          <form onSubmit={handleLogin} className='space-y-4'>
            <div className='space-y-2'>
              <label className='text-xs font-semibold text-slate-500'>NIK</label>
              <input
                type='text'
                inputMode='numeric'
                value={nik}
                onChange={(event) => setNik(event.target.value)}
                className='w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal-400'
                placeholder='Masukkan NIK'
              />
            </div>

            {error && <p className='text-sm text-red-600'>{error}</p>}

            <button
              type='submit'
              disabled={loading}
              className='btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-70'
            >
              {loading ? 'Memeriksa...' : 'Lanjut'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
