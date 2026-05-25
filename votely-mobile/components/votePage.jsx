import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FaceScanner from './faceScanner.jsx'
import { castVote, checkVote, getElectionDetail, verifyFace } from '../lib/api'

function getElectionStatus(election) {
  const now = new Date()
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)
  if (now < start) return 'upcoming'
  if (now > end) return 'finished'
  return 'active'
}

function VotePage() {
  const { electionId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [election, setElection] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [voteToken, setVoteToken] = useState('')
  const [showFace, setShowFace] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [votedCandidate, setVotedCandidate] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setLoading(true)
        const [electionResponse, voteResponse] = await Promise.all([
          getElectionDetail(electionId, true),
          checkVote(electionId),
        ])
        if (!active) return
        setElection(electionResponse?.data || null)
        if (voteResponse?.data?.hasVoted) {
          setHasVoted(true)
          setVotedCandidate(voteResponse.data.candidateName)
        }
      } catch (err) {
        if (!active) return
        setError(err.message || 'Gagal memuat data voting')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [electionId])

  const handleFaceCapture = async (image) => {
    setVerifying(true)
    setError('')
    try {
      const response = await verifyFace(image, { electionId })
      if (!response?.verified || !response?.voteToken) {
        throw new Error(response?.message || 'Verifikasi wajah gagal')
      }
      setVoteToken(response.voteToken)
      setShowFace(false)
    } catch (err) {
      setError(err.message || 'Verifikasi wajah gagal')
    } finally {
      setVerifying(false)
    }
  }

  const handleSubmitVote = async () => {
    if (!selectedCandidate) {
      setError('Pilih kandidat terlebih dahulu.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await castVote({ electionId, candidateId: selectedCandidate, voteToken })
      setHasVoted(true)
      const candidateName = election?.candidates?.find((item) => item.id === selectedCandidate)?.name
      setVotedCandidate(candidateName || null)
    } catch (err) {
      setError(err.message || 'Voting gagal')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen votely-bg flex items-center justify-center'>
        <div className='glass-panel rounded-2xl p-6 text-sm text-slate-500'>Memuat voting...</div>
      </div>
    )
  }

  if (error && !election) {
    return (
      <div className='min-h-screen votely-bg flex items-center justify-center px-6'>
        <div className='glass-panel rounded-2xl p-6 text-center space-y-3'>
          <p className='text-red-600'>{error}</p>
          <button onClick={() => navigate('/dashboard')} className='btn-primary px-4 py-2 rounded-xl text-sm'>
            Kembali
          </button>
        </div>
      </div>
    )
  }

  const status = election ? getElectionStatus(election) : 'finished'

  return (
    <div className='min-h-screen votely-bg pb-20'>
      <div className='px-6 pt-8 space-y-6'>
        <button onClick={() => navigate(`/elections/${electionId}`)} className='text-xs font-semibold text-slate-500'>
          Kembali
        </button>

        <div className='glass-panel rounded-3xl border-glow p-6 space-y-2'>
          <h1 className='text-xl font-bold text-slate-800'>{election?.name}</h1>
          <p className='text-sm text-slate-500'>Pilih kandidat dan verifikasi wajah.</p>
        </div>

        {status !== 'active' && (
          <div className='glass-panel rounded-2xl p-4 border border-amber-200 text-sm text-amber-700'>
            Pemilu belum aktif atau sudah selesai.
          </div>
        )}

        {hasVoted ? (
          <div className='glass-panel rounded-2xl p-5 border-glow space-y-2'>
            <p className='text-sm text-slate-600'>Anda sudah memilih.</p>
            {votedCandidate && <p className='font-semibold text-slate-800'>Pilihan: {votedCandidate}</p>}
            <button onClick={() => navigate(`/elections/${electionId}`)} className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'>
              Lihat Detail
            </button>
          </div>
        ) : (
          <>
            {!voteToken && status === 'active' && (
              <div className='space-y-3'>
                {showFace ? (
                  <FaceScanner
                    title='Verifikasi Wajah'
                    description='Verifikasi wajah untuk mendapatkan token voting.'
                    onCapture={handleFaceCapture}
                    onCancel={() => setShowFace(false)}
                    busy={verifying}
                    confirmLabel='Verifikasi'
                  />
                ) : (
                  <button
                    className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'
                    onClick={() => setShowFace(true)}
                  >
                    Verifikasi Wajah
                  </button>
                )}
              </div>
            )}

            {voteToken && status === 'active' && (
              <div className='space-y-4'>
                <div className='glass-panel rounded-2xl p-4 border-glow'>
                  <p className='text-xs text-slate-500'>Token voting aktif</p>
                  <p className='text-sm text-emerald-600 font-semibold'>Terverifikasi</p>
                </div>

                <div className='space-y-3'>
                  {election?.candidates?.map((candidate) => (
                    <label
                      key={candidate.id}
                      className={`glass-panel rounded-2xl p-4 border-glow flex items-center justify-between gap-4 cursor-pointer ${
                        selectedCandidate === candidate.id ? 'ring-2 ring-teal-400' : ''
                      }`}
                    >
                      <div>
                        <p className='font-semibold text-slate-800'>{candidate.name}</p>
                        <p className='text-xs text-slate-500'>{candidate.party}</p>
                      </div>
                      <input
                        type='radio'
                        name='candidate'
                        value={candidate.id}
                        checked={selectedCandidate === candidate.id}
                        onChange={() => setSelectedCandidate(candidate.id)}
                        className='h-4 w-4 accent-teal-500'
                      />
                    </label>
                  ))}
                </div>

                {error && <p className='text-sm text-red-600'>{error}</p>}

                <button
                  className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'
                  onClick={handleSubmitVote}
                  disabled={submitting}
                >
                  {submitting ? 'Mengirim suara...' : 'Kirim Suara'}
                </button>
              </div>
            )}
          </>
        )}

        {error && election && <p className='text-sm text-red-600'>{error}</p>}
      </div>
    </div>
  )
}

export default VotePage
