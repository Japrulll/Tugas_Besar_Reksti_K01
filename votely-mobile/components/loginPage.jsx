import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login, validateCredentials, verifyFace } from '../lib/api'
import FaceScanner from './faceScanner.jsx'
import { useAuth } from '../App.jsx'

function LoginPage() {
    const navigate = useNavigate()
    const { refreshUser } = useAuth()
    const [nik, setNik] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [showFace, setShowFace] = useState(false)
    const [faceError, setFaceError] = useState('')
    const [faceNotRegistered, setFaceNotRegistered] = useState(false)

    const runLogin = async () => {
        const data = await login(nik, password)
        await refreshUser()
        const role = data?.data?.role
        navigate(role === 'ADMIN' ? '/admin' : '/dashboard', { replace: true })
    }

    async function handleLogin(event) {
        event.preventDefault()
        setError('')
        setFaceError('')
        setFaceNotRegistered(false)
        setLoading(true)
        try {
            if (!nik || !password) {
                throw new Error('NIK dan password wajib diisi.')
            }
            await validateCredentials(nik, password)
            setShowFace(true)
        } catch (err) {
            setError(err.message || 'Login gagal')
        } finally {
            setLoading(false)
        }
    }

    const handleFaceCapture = async (image) => {
        setFaceError('')
        setLoading(true)
        try {
            const response = await verifyFace(image, { nik })
            if (!response?.verified) {
                throw new Error(response?.message || 'Verifikasi wajah gagal')
            }
            await runLogin()
        } catch (err) {
            const message = err?.message || 'Verifikasi wajah gagal'
            if (message.toLowerCase().includes('no face embedding')) {
                setFaceNotRegistered(true)
                setFaceError('Wajah belum terdaftar. Anda dapat lanjut login tanpa verifikasi.')
            } else {
                setFaceError(message)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleSkipFace = async () => {
        setLoading(true)
        try {
            await runLogin()
        } catch (err) {
            setError(err.message || 'Login gagal')
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

                {showFace ? (
                    <div className='space-y-4'>
                        <FaceScanner
                            title='Verifikasi Wajah'
                            description='Posisikan wajah Anda di tengah bingkai untuk melanjutkan.'
                            onCapture={handleFaceCapture}
                            onCancel={() => setShowFace(false)}
                            busy={loading}
                            confirmLabel='Verifikasi'
                        />
                        {faceError && (
                            <div className='rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700'>
                                {faceError}
                            </div>
                        )}
                        {faceNotRegistered && (
                            <button
                                type='button'
                                className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'
                                onClick={handleSkipFace}
                                disabled={loading}
                            >
                                Lanjut Login
                            </button>
                        )}
                    </div>
                ) : (
                    <div className='glass-panel rounded-3xl border-glow p-6 space-y-5'>
                        <div className='space-y-1'>
                            <h1 className='text-2xl font-bold text-slate-800'>Masuk</h1>
                            <p className='text-sm text-slate-500'>Masukkan NIK dan password Anda.</p>
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
                            <div className='space-y-2'>
                                <label className='text-xs font-semibold text-slate-500'>Password</label>
                                <input
                                    type='password'
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className='w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal-400'
                                    placeholder='Masukkan password'
                                />
                            </div>

                            {error && <p className='text-sm text-red-600'>{error}</p>}

                            <button
                                type='submit'
                                disabled={loading}
                                className='btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-70'
                            >
                                {loading ? 'Memeriksa...' : 'Lanjut Verifikasi'}
                            </button>
                        </form>

                        <div className='text-sm text-slate-500 text-center'>
                            Belum punya akun?{' '}
                            <Link to='/auth/register' className='font-semibold text-teal-600'>
                                Daftar sekarang
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default LoginPage
