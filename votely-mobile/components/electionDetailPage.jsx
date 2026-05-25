import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getElectionDetail } from '../lib/api'

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
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

function getLocation(election) {
  if (election.level === 'NASIONAL') return 'Seluruh Indonesia'
  if (election.level === 'PROVINSI') return election.province || '-'
  if (election.level === 'KOTA') return `${election.city}, ${election.province}`
  return '-'
}

function ElectionDetailPage() {
  const { electionId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [election, setElection] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        const response = await getElectionDetail(electionId, true)
        if (!active) return
        setElection(response?.data || null)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat pemilu')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [electionId])

  if (loading) {
    return (
      <div className='min-h-screen votely-bg flex items-center justify-center'>
        <div className='glass-panel rounded-2xl p-6 text-sm text-slate-500'>Memuat detail pemilu...</div>
      </div>
    )
  }

  if (error || !election) {
    return (
      <div className='min-h-screen votely-bg flex items-center justify-center px-6'>
        <div className='glass-panel rounded-2xl p-6 text-center space-y-3'>
          <p className='text-red-600'>{error || 'Pemilu tidak ditemukan'}</p>
          <button onClick={() => navigate('/dashboard')} className='btn-primary px-4 py-2 rounded-xl text-sm'>
            Kembali
          </button>
        </div>
      </div>
    )
  }

  const status = getElectionStatus(election)

  return (
    <div className='min-h-screen votely-bg pb-20'>
      <div className='px-6 pt-8 space-y-6'>
        <div className='flex items-center justify-between'>
          <button onClick={() => navigate('/dashboard')} className='text-xs font-semibold text-slate-500'>
            Kembali
          </button>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              status === 'active' ? 'badge-success' : status === 'upcoming' ? 'badge-warning' : 'badge-muted'
            }`}
          >
            {status === 'active' ? 'Berlangsung' : status === 'upcoming' ? 'Akan Datang' : 'Selesai'}
          </span>
        </div>

        <div className='glass-panel rounded-3xl border-glow p-6 space-y-3'>
          <div>
            <h1 className='text-2xl font-bold text-slate-800'>{election.name}</h1>
            <p className='text-sm text-slate-500'>{getLocation(election)}</p>
          </div>
          <p className='text-sm text-slate-600'>{election.description || 'Deskripsi belum tersedia.'}</p>
          <div className='text-xs text-slate-500'>
            {formatDate(election.startTime)} - {formatDate(election.endTime)}
          </div>
          {status === 'active' && (
            <Link to={`/elections/${election.id}/vote`} className='btn-primary block text-center rounded-xl py-3 text-sm font-semibold'>
              Mulai Voting
            </Link>
          )}
        </div>

        <div className='space-y-3'>
          <h2 className='text-lg font-semibold text-slate-800'>Kandidat</h2>
          <div className='space-y-3'>
            {election.candidates?.map((candidate) => (
              <div key={candidate.id} className='glass-panel rounded-2xl p-4 border-glow space-y-2'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-semibold text-slate-800'>{candidate.name}</p>
                    <p className='text-xs text-slate-500'>{candidate.party}</p>
                  </div>
                  {status !== 'upcoming' && (
                    <span className='text-xs font-semibold text-slate-600'>{candidate.voteCount || 0} suara</span>
                  )}
                </div>
                {candidate.description && <p className='text-xs text-slate-500'>{candidate.description}</p>}
              </div>
            ))}
          </div>
        </div>

        {status === 'finished' && (
          <div className='glass-panel rounded-2xl p-4 border-glow'>
            <p className='text-sm text-slate-600'>Total suara: {election.totalVotes || 0}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ElectionDetailPage
