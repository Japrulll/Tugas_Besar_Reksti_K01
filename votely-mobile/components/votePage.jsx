import { useEffect, useMemo, useState } from 'react'
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

function abbreviate(text) {
  if (!text) return '-'
  return text.length <= 18 ? text : `${text.slice(0, 8)}...${text.slice(-6)}`
}

function buildInitials(name) {
  if (!name) return '??'
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
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
  const [receipt, setReceipt] = useState(null)

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
          setReceipt({
            candidateName: voteResponse.data.candidateName,
            txHash: voteResponse.data.txHash,
            proofHash: voteResponse.data.proofHash,
            votedAt: voteResponse.data.votedAt,
          })
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

  const status = election ? getElectionStatus(election) : 'finished'

  const selectedCandidateName = useMemo(() => {
    return election?.candidates?.find((item) => item.id === selectedCandidate)?.name || ''
  }, [election, selectedCandidate])

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
    if (!voteToken) {
      setError('Verifikasi wajah wajib sebelum vote.')
      setShowFace(true)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await castVote({ electionId, candidateId: selectedCandidate, voteToken })
      setReceipt({
        candidateName: selectedCandidateName,
        txHash: response?.data?.transactionHash,
        proofHash: response?.data?.proofHash,
        votedAt: response?.data?.votedAt,
      })
    } catch (err) {
      setError(err.message || 'Voting gagal')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadProof = () => {
    if (!receipt || !election) return
    const lines = [
      `Pemilu: ${election.name}`,
      `Kandidat: ${receipt.candidateName || '-'}`,
      `Tx Hash: ${receipt.txHash || '-'}`,
      `Proof Hash: ${receipt.proofHash || '-'}`,
      `Waktu: ${receipt.votedAt || new Date().toISOString()}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `votely-proof-${electionId}.txt`
    link.click()
    URL.revokeObjectURL(url)
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

  if (receipt) {
    return (
      <div className='min-h-screen votely-bg flex items-center justify-center px-6'>
        <div className='glass-panel rounded-3xl border-glow p-8 text-center space-y-4 max-w-md w-full'>
          <div className='w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl'>
            ✓
          </div>
          <div>
            <h1 className='text-2xl font-bold text-slate-800'>Suaramu Tercatat!</h1>
            <p className='text-sm text-slate-500'>Suaramu telah disimpan di blockchain.</p>
          </div>
          <div className='rounded-2xl bg-white/70 border border-slate-200 p-4 text-sm text-slate-600 space-y-1 text-left'>
            <p><span className='font-semibold'>Kandidat:</span> {receipt.candidateName || '-'}</p>
            <p><span className='font-semibold'>Tx Hash:</span> {abbreviate(receipt.txHash)}</p>
            <p><span className='font-semibold'>Proof Hash:</span> {abbreviate(receipt.proofHash)}</p>
          </div>
          <button onClick={handleDownloadProof} className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'>
            Simpan Bukti
          </button>
          <button onClick={() => navigate(`/elections/${electionId}`)} className='btn-secondary w-full rounded-xl py-3 text-sm font-semibold'>
            Kembali
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen votely-bg pb-20'>
      <div className='px-6 pt-8 space-y-6'>
        <div className='flex items-center justify-between'>
          <button onClick={() => navigate(`/elections/${electionId}`)} className='text-xs font-semibold text-slate-500'>
            Kembali
          </button>
          <span className='text-xs text-slate-400'>{election?.name}</span>
        </div>

        <div className='glass-panel rounded-3xl border-glow p-6 text-center space-y-2'>
          <h1 className='text-xl font-bold text-slate-800'>Pilih Kandidatmu!</h1>
          <p className='text-sm text-slate-500'>Pemilu {election?.name}</p>
        </div>

        {status !== 'active' && (
          <div className='glass-panel rounded-2xl p-4 border border-amber-200 text-sm text-amber-700 text-center'>
            Pemilu belum aktif atau sudah selesai.
          </div>
        )}

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
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              {election?.candidates?.map((candidate) => (
                <button
                  key={candidate.id}
                  type='button'
                  onClick={() => setSelectedCandidate(candidate.id)}
                  className={`glass-panel rounded-2xl border-glow p-4 text-center space-y-3 ${
                    selectedCandidate === candidate.id ? 'ring-2 ring-teal-400' : ''
                  }`}
                >
                  {candidate.photoUrl ? (
                    <img
                      src={candidate.photoUrl}
                      alt={candidate.name}
                      className='w-20 h-20 rounded-full object-cover mx-auto border border-white'
                    />
                  ) : (
                    <div className='w-20 h-20 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto text-lg font-semibold'>
                      {buildInitials(candidate.name)}
                    </div>
                  )}
                  <p className='font-semibold text-slate-800 text-sm'>{candidate.name}</p>
                  <p className='text-xs text-slate-500'>{candidate.party}</p>
                </button>
              ))}
            </div>

            {error && <p className='text-sm text-red-600 text-center'>{error}</p>}

            <button
              className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'
              onClick={handleSubmitVote}
              disabled={submitting}
            >
              {submitting ? 'Mengirim suara...' : 'Vote'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VotePage
