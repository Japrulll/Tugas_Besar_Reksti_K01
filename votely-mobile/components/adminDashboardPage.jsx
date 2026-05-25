import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAdminElections } from '../lib/api'

function getElectionStatus(election) {
  const now = new Date()
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)
  if (now < start) return 'upcoming'
  if (now > end) return 'finished'
  return 'active'
}

function AdminDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [elections, setElections] = useState([])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await getAdminElections()
        if (!active) return
        setElections(response?.data || [])
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat data admin')
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
            <h1 className='text-2xl font-bold text-slate-800'>Admin Pemilu</h1>
            <p className='text-sm text-slate-500'>Kelola pemilu dan kandidat.</p>
          </div>
          <button onClick={() => navigate('/dashboard')} className='text-xs font-semibold text-teal-600'>
            User
          </button>
        </div>

        <Link to='/admin/elections/new' className='btn-primary block text-center rounded-xl py-3 text-sm font-semibold'>
          Buat Pemilu Baru
        </Link>

        {loading ? (
          <div className='glass-panel rounded-2xl p-6 text-center text-sm text-slate-500'>Memuat data...</div>
        ) : error ? (
          <div className='glass-panel rounded-2xl p-6 text-center text-sm text-red-600'>{error}</div>
        ) : (
          <div className='space-y-3'>
            {elections.map((election) => {
              const status = getElectionStatus(election)
              return (
                <div key={election.id} className='glass-panel rounded-2xl p-4 border-glow space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <p className='font-semibold text-slate-800'>{election.name}</p>
                      <p className='text-xs text-slate-500'>{election.level}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      status === 'active' ? 'badge-success' : status === 'upcoming' ? 'badge-warning' : 'badge-muted'
                    }`}>
                      {status === 'active' ? 'Aktif' : status === 'upcoming' ? 'Akan Datang' : 'Selesai'}
                    </span>
                  </div>
                  <div className='text-xs text-slate-500'>
                    Kandidat: {election.candidates?.length || 0}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboardPage
