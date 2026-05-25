import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getElectionsForUser } from '../lib/api'
import { useAuth } from '../App.jsx'

function getElectionStatus(election) {
  const now = new Date()
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)
  if (now < start) return 'upcoming'
  if (now > end) return 'finished'
  return 'active'
}

function formatDate(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

function getLocation(election) {
  if (election.level === 'NASIONAL') return 'Seluruh Indonesia'
  if (election.level === 'PROVINSI') return election.province || '-'
  if (election.level === 'KOTA') return `${election.city}, ${election.province}`
  return '-'
}

function StatusBadge({ status }) {
  const label = status === 'active' ? 'Berlangsung' : status === 'upcoming' ? 'Akan Datang' : 'Selesai'
  const className =
    status === 'active'
      ? 'badge-success'
      : status === 'upcoming'
      ? 'badge-warning'
      : 'badge-muted'
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${className}`}>{label}</span>
  )
}

function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [elections, setElections] = useState([])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        const response = await getElectionsForUser()
        if (!active) return
        setElections(response?.data || [])
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat data pemilu')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className='min-h-screen votely-bg pb-20'>
      <div className='px-6 pt-8 space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-xs text-slate-500'>Selamat datang</p>
            <h1 className='text-2xl font-bold text-slate-800'>Dashboard Pemilu</h1>
          </div>
          <button onClick={signOut} className='text-xs font-semibold text-teal-600'>
            Keluar
          </button>
        </div>

        <div className='glass-panel rounded-2xl p-4 border-glow'>
          <p className='text-xs text-slate-500'>Akun terhubung</p>
          <p className='font-semibold text-slate-700'>{user?.penduduk?.namaLengkap || 'Warga'}</p>
          <p className='text-xs text-slate-400'>NIK: {user?.penduduk?.nik || '-'}</p>
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-slate-800'>Pemilu Tersedia</h2>
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => navigate('/admin')}
                className='text-xs font-semibold text-teal-600'
              >
                Admin
              </button>
            )}
          </div>

          {loading ? (
            <div className='glass-panel rounded-2xl p-6 text-center text-sm text-slate-500'>Memuat data...</div>
          ) : error ? (
            <div className='glass-panel rounded-2xl p-6 text-center text-sm text-red-600'>{error}</div>
          ) : elections.length === 0 ? (
            <div className='glass-panel rounded-2xl p-6 text-center text-sm text-slate-500'>Belum ada pemilu.</div>
          ) : (
            <div className='space-y-3'>
              {elections.map((election) => {
                const status = getElectionStatus(election)
                return (
                  <Link
                    key={election.id}
                    to={`/elections/${election.id}`}
                    className='block glass-panel rounded-2xl p-4 border-glow hover:shadow-md transition'
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <div>
                        <h3 className='font-semibold text-slate-800'>{election.name}</h3>
                        <p className='text-xs text-slate-500'>{getLocation(election)}</p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <div className='mt-3 text-xs text-slate-500 flex items-center justify-between'>
                      <span>{formatDate(election.startTime)} - {formatDate(election.endTime)}</span>
                      <span>{election.candidates?.length || 0} kandidat</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
