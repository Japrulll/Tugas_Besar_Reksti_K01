import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import LoginPage from './components/loginPage.jsx'
import {
  castVote,
  checkVote,
  clearStoredToken,
  getCurrentUser,
  getElection,
  getElectionsForUser,
  getStoredToken,
  logout,
  verifyFace,
} from './lib/api'

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getElectionStatus(election) {
  const now = new Date()
  const start = new Date(election.startTime)
  const end = new Date(election.endTime)

  if (now < start) return 'upcoming'
  if (now > end) return 'finished'
  return 'active'
}

function getStatusLabel(status) {
  if (status === 'active') return 'Berlangsung'
  if (status === 'upcoming') return 'Akan Datang'
  return 'Selesai'
}

function getLocation(election) {
  if (!election) return '-'
  if (election.level === 'NASIONAL') return 'Seluruh Indonesia'
  if (election.level === 'PROVINSI') return election.province || '-'
  if (election.level === 'KOTA') return [election.city, election.province].filter(Boolean).join(', ') || '-'
  return election.province || election.city || '-'
}

function shortHash(value) {
  if (!value) return '-'
  if (value.length <= 22) return value
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function MobileFrame({ children }) {
  return (
    <main className="mobile-app">
      <div className="phone-shell">{children}</div>
    </main>
  )
}

function TopBar({ title, subtitle, onBack, onLogout }) {
  return (
    <header className="top-bar">
      <button className="icon-button" onClick={onBack} aria-label="Kembali" disabled={!onBack}>
        {onBack ? '<' : ''}
      </button>
      <div>
        <p>{title}</p>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <button className="text-button" onClick={onLogout}>
        Keluar
      </button>
    </header>
  )
}

function LoadingScreen({ message = 'Memuat data...' }) {
  return (
    <MobileFrame>
      <div className="center-state">
        <div className="loader" />
        <p>{message}</p>
      </div>
    </MobileFrame>
  )
}

function EmptyState({ title, description }) {
  return (
    <section className="empty-state">
      <div className="empty-icon">i</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  )
}

function Dashboard({ user, elections, loading, error, onOpenElection, onRefresh, onLogout }) {
  const stats = useMemo(() => {
    const active = elections.filter((item) => getElectionStatus(item) === 'active').length
    const upcoming = elections.filter((item) => getElectionStatus(item) === 'upcoming').length
    return { active, upcoming }
  }, [elections])

  return (
    <MobileFrame>
      <TopBar
        title="Votely"
        subtitle={user?.penduduk?.namaLengkap || 'Pemilih terverifikasi'}
        onLogout={onLogout}
      />

      <section className="home-hero">
        <div>
          <p className="eyebrow">Dashboard Pemilih</p>
          <h1>Pemilu yang tersedia untuk wilayah Anda.</h1>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          Refresh
        </button>
      </section>

      <section className="stat-grid">
        <article>
          <strong>{elections.length}</strong>
          <span>Total Pemilu</span>
        </article>
        <article>
          <strong>{stats.active}</strong>
          <span>Berlangsung</span>
        </article>
        <article>
          <strong>{stats.upcoming}</strong>
          <span>Akan Datang</span>
        </article>
      </section>

      {error && <p className="error-banner">{error}</p>}

      <section className="content-stack">
        <div className="section-heading">
          <h2>Daftar Pemilu</h2>
          <span>{loading ? 'Sinkronisasi' : `${elections.length} agenda`}</span>
        </div>

        {loading ? (
          <div className="inline-loading">
            <div className="loader small" />
            <span>Memuat pemilu...</span>
          </div>
        ) : elections.length === 0 ? (
          <EmptyState title="Belum ada pemilu" description="Tidak ada pemilu yang dapat Anda ikuti saat ini." />
        ) : (
          elections.map((election) => {
            const status = getElectionStatus(election)
            return (
              <button
                key={election.id}
                className="election-card"
                onClick={() => onOpenElection(election.id)}
              >
                <div>
                  <span className={`status-pill ${status}`}>{getStatusLabel(status)}</span>
                  <h3>{election.name}</h3>
                  <p>{getLocation(election)}</p>
                </div>
                <div className="card-meta">
                  <span>{formatDate(election.startTime)}</span>
                  <span>{election.candidates?.length || 0} kandidat</span>
                </div>
              </button>
            )
          })
        )}
      </section>
    </MobileFrame>
  )
}

function ElectionDetail({ election, voteStatus, loading, onBack, onStartVote, onLogout, onRefresh }) {
  if (loading || !election) {
    return <LoadingScreen message="Memuat detail pemilu..." />
  }

  const status = getElectionStatus(election)
  const totalVotes = election.totalVotes || election._count?.votes || 0

  return (
    <MobileFrame>
      <TopBar title="Detail Pemilu" subtitle={getStatusLabel(status)} onBack={onBack} onLogout={onLogout} />

      <section className="detail-hero">
        <span className={`status-pill ${status}`}>{getStatusLabel(status)}</span>
        <h1>{election.name}</h1>
        <p>{election.description || 'Tidak ada deskripsi pemilu.'}</p>
      </section>

      <section className="info-grid">
        <article>
          <span>Wilayah</span>
          <strong>{getLocation(election)}</strong>
        </article>
        <article>
          <span>Mulai</span>
          <strong>{formatDate(election.startTime)}</strong>
        </article>
        <article>
          <span>Kandidat</span>
          <strong>{election.candidates?.length || 0}</strong>
        </article>
        <article>
          <span>Suara</span>
          <strong>{totalVotes}</strong>
        </article>
      </section>

      {voteStatus?.hasVoted && (
        <section className="proof-card compact">
          <p className="eyebrow">Status Voting</p>
          <h2>Anda sudah memilih</h2>
          <p>Suara tercatat pada {formatDateTime(voteStatus.votedAt)}.</p>
          <code>{shortHash(voteStatus.proofHash || voteStatus.txHash)}</code>
        </section>
      )}

      <section className="content-stack">
        <div className="section-heading">
          <h2>Kandidat</h2>
          <button className="text-link" onClick={onRefresh}>Muat ulang</button>
        </div>

        {election.candidates?.length ? (
          election.candidates.map((candidate) => (
            <article key={candidate.id} className="candidate-row">
              <CandidatePhoto candidate={candidate} />
              <div>
                <h3>{candidate.name}</h3>
                <p>{candidate.party}</p>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="Belum ada kandidat" description="Daftar kandidat belum tersedia." />
        )}
      </section>

      <footer className="sticky-actions">
        <button
          className="primary-button"
          onClick={onStartVote}
          disabled={status !== 'active' || voteStatus?.hasVoted}
        >
          {voteStatus?.hasVoted ? 'Suara Sudah Tercatat' : status === 'active' ? 'Mulai Voting' : 'Voting Tidak Aktif'}
        </button>
      </footer>
    </MobileFrame>
  )
}

function CandidatePhoto({ candidate }) {
  if (candidate.photoUrl) {
    return <img className="candidate-photo" src={candidate.photoUrl} alt={candidate.name} />
  }

  return (
    <div className="candidate-photo fallback" aria-hidden="true">
      {candidate.name?.charAt(0) || '?'}
    </div>
  )
}

function FaceVerification({ nik, electionId, onVerified }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cameraOn) return undefined

    let mounted = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current && mounted) {
          videoRef.current.srcObject = stream
          setCameraReady(true)
        }
      } catch (err) {
        setError(err?.message || 'Kamera tidak dapat diakses.')
        setCameraOn(false)
      }
    }

    startCamera()

    return () => {
      mounted = false
      setCameraReady(false)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [cameraOn])

  async function handleCapture() {
    if (!videoRef.current || !canvasRef.current) return

    setLoading(true)
    setError('')
    try {
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const image = canvas.toDataURL('image/jpeg', 0.92)
      const result = await verifyFace({ image, nik, electionId })

      if (!result.verified || !result.voteToken) {
        throw new Error(result.message || 'Verifikasi wajah belum berhasil.')
      }

      onVerified(result.voteToken, result)
    } catch (err) {
      setError(err.message || 'Gagal memverifikasi wajah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="verify-panel">
      <div className="step-badge">Langkah 1</div>
      <h2>Verifikasi wajah</h2>
      <p>Posisikan wajah di tengah frame. Setelah cocok, sistem akan menerbitkan token voting sekali pakai.</p>

      <div className="camera-box">
        {cameraOn ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted />
            {!cameraReady && <span>Mengaktifkan kamera...</span>}
          </>
        ) : (
          <div className="camera-placeholder">
            <strong>Face Recognition</strong>
            <span>Kamera akan digunakan untuk verifikasi identitas.</span>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden-canvas" width="720" height="720" />

      {error && <p className="error-banner">{error}</p>}

      <div className="button-row">
        <button className="ghost-button" onClick={() => setCameraOn((value) => !value)} disabled={loading}>
          {cameraOn ? 'Matikan Kamera' : 'Aktifkan Kamera'}
        </button>
        <button className="primary-button" onClick={handleCapture} disabled={!cameraReady || loading}>
          {loading ? 'Memeriksa...' : 'Verifikasi'}
        </button>
      </div>
    </section>
  )
}

function VotingFlow({ election, user, voteStatus, onBack, onDone, onLogout }) {
  const [voteToken, setVoteToken] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const status = getElectionStatus(election)

  async function handleSubmitVote() {
    if (!selectedCandidate || !voteToken) return

    setSubmitting(true)
    setError('')
    try {
      const result = await castVote({
        electionId: election.id,
        candidateId: selectedCandidate.id,
        voteToken,
      })
      onDone({
        candidate: selectedCandidate,
        proofHash: result.data?.proofHash,
        transactionHash: result.data?.transactionHash,
        votedAt: result.data?.votedAt,
      })
    } catch (err) {
      setError(err.message || 'Gagal mengirim suara.')
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <MobileFrame>
      <TopBar title="Voting" subtitle={election.name} onBack={onBack} onLogout={onLogout} />

      {status !== 'active' ? (
        <EmptyState title="Voting tidak aktif" description="Pemilu ini belum dapat menerima suara." />
      ) : voteStatus?.hasVoted ? (
        <EmptyState title="Anda sudah memilih" description="Setiap pemilih hanya dapat mencoblos satu kali." />
      ) : (
        <>
          {!voteToken ? (
            <FaceVerification
              nik={user?.penduduk?.nik}
              electionId={election.id}
              onVerified={(token) => setVoteToken(token)}
            />
          ) : (
            <section className="token-card">
              <div className="step-badge success">Langkah 1 selesai</div>
              <h2>Token voting aktif</h2>
              <p>Token sudah diterbitkan dan akan dikirim bersama suara Anda.</p>
            </section>
          )}

          <section className={`content-stack ${!voteToken ? 'disabled-stack' : ''}`}>
            <div className="section-heading">
              <h2>Langkah 2: Pilih kandidat</h2>
              <span>{election.candidates?.length || 0} kandidat</span>
            </div>

            {election.candidates?.map((candidate) => (
              <button
                key={candidate.id}
                className={`candidate-card ${selectedCandidate?.id === candidate.id ? 'selected' : ''}`}
                onClick={() => setSelectedCandidate(candidate)}
                disabled={!voteToken}
              >
                <CandidatePhoto candidate={candidate} />
                <div>
                  <h3>{candidate.name}</h3>
                  <p>{candidate.party}</p>
                  {candidate.description && <span>{candidate.description}</span>}
                </div>
              </button>
            ))}
          </section>

          {error && <p className="error-banner">{error}</p>}

          <footer className="sticky-actions">
            <button
              className="primary-button"
              onClick={() => setConfirmOpen(true)}
              disabled={!voteToken || !selectedCandidate || submitting}
            >
              Konfirmasi Pilihan
            </button>
          </footer>

          {confirmOpen && (
            <div className="modal-backdrop" role="dialog" aria-modal="true">
              <section className="confirm-modal">
                <h2>Konfirmasi suara?</h2>
                <p>Suara untuk kandidat berikut akan dicatat permanen ke blockchain.</p>
                <div className="confirm-choice">
                  <strong>{selectedCandidate?.name}</strong>
                  <span>{selectedCandidate?.party}</span>
                </div>
                <div className="button-row">
                  <button className="ghost-button" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                    Batal
                  </button>
                  <button className="primary-button" onClick={handleSubmitVote} disabled={submitting}>
                    {submitting ? 'Mengirim...' : 'Kirim Suara'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </MobileFrame>
  )
}

function ReceiptScreen({ receipt, election, onHome, onLogout }) {
  return (
    <MobileFrame>
      <TopBar title="Bukti Voting" subtitle="Suara berhasil dicatat" onLogout={onLogout} />

      <section className="proof-card">
        <div className="success-mark">OK</div>
        <p className="eyebrow">Vote Confirmation</p>
        <h1>Suara berhasil dikirim</h1>
        <p>Bukti hash ini tidak membuka pilihan Anda, tetapi dapat dipakai untuk audit dan verifikasi.</p>
        <code>{receipt.proofHash || receipt.transactionHash || '-'}</code>
      </section>

      <section className="receipt-details">
        <article>
          <span>Pemilu</span>
          <strong>{election.name}</strong>
        </article>
        <article>
          <span>Kandidat</span>
          <strong>{receipt.candidate?.name}</strong>
        </article>
        <article>
          <span>Waktu</span>
          <strong>{formatDateTime(receipt.votedAt)}</strong>
        </article>
        <article>
          <span>Transaksi</span>
          <strong>{shortHash(receipt.transactionHash)}</strong>
        </article>
      </section>

      <footer className="sticky-actions">
        <button className="primary-button" onClick={onHome}>
          Kembali ke Dashboard
        </button>
      </footer>
    </MobileFrame>
  )
}

function App() {
  const [booting, setBooting] = useState(true)
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)
  const [elections, setElections] = useState([])
  const [selectedElection, setSelectedElection] = useState(null)
  const [voteStatus, setVoteStatus] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadUserSession() {
    if (!getStoredToken()) {
      setBooting(false)
      return
    }

    try {
      const result = await getCurrentUser()
      setUser(result.data)
      setScreen('dashboard')
      await loadElections()
    } catch {
      clearStoredToken()
      setScreen('login')
    } finally {
      setBooting(false)
    }
  }

  async function loadElections() {
    setLoading(true)
    setError('')
    try {
      const result = await getElectionsForUser()
      setElections(result.data || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat daftar pemilu.')
    } finally {
      setLoading(false)
    }
  }

  async function openElection(electionId) {
    setLoading(true)
    setError('')
    try {
      const [electionResult, voteResult] = await Promise.all([
        getElection(electionId, true),
        checkVote(electionId),
      ])
      setSelectedElection(electionResult.data)
      setVoteStatus(voteResult.data)
      setScreen('detail')
    } catch (err) {
      setError(err.message || 'Gagal memuat detail pemilu.')
    } finally {
      setLoading(false)
    }
  }

  async function refreshSelectedElection() {
    if (!selectedElection) return
    await openElection(selectedElection.id)
  }

  async function handleLogout() {
    await logout()
    setUser(null)
    setElections([])
    setSelectedElection(null)
    setVoteStatus(null)
    setReceipt(null)
    setScreen('login')
  }

  useEffect(() => {
    loadUserSession()
  }, [])

  if (booting) {
    return <LoadingScreen message="Membuka Votely..." />
  }

  if (screen === 'login') {
    return (
      <LoginPage
        onLoggedIn={async () => {
          const result = await getCurrentUser()
          setUser(result.data)
          setScreen('dashboard')
          await loadElections()
        }}
      />
    )
  }

  if (screen === 'detail') {
    return (
      <ElectionDetail
        election={selectedElection}
        voteStatus={voteStatus}
        loading={loading}
        onBack={() => setScreen('dashboard')}
        onStartVote={() => setScreen('vote')}
        onLogout={handleLogout}
        onRefresh={refreshSelectedElection}
      />
    )
  }

  if (screen === 'vote' && selectedElection) {
    return (
      <VotingFlow
        election={selectedElection}
        user={user}
        voteStatus={voteStatus}
        onBack={() => setScreen('detail')}
        onLogout={handleLogout}
        onDone={(nextReceipt) => {
          setReceipt(nextReceipt)
          setVoteStatus({
            hasVoted: true,
            candidateId: nextReceipt.candidate?.id,
            candidateName: nextReceipt.candidate?.name,
            proofHash: nextReceipt.proofHash,
            txHash: nextReceipt.transactionHash,
            votedAt: nextReceipt.votedAt,
          })
          setScreen('receipt')
        }}
      />
    )
  }

  if (screen === 'receipt' && receipt && selectedElection) {
    return (
      <ReceiptScreen
        receipt={receipt}
        election={selectedElection}
        onHome={async () => {
          await loadElections()
          setScreen('dashboard')
        }}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <Dashboard
      user={user}
      elections={elections}
      loading={loading}
      error={error}
      onOpenElection={openElection}
      onRefresh={loadElections}
      onLogout={handleLogout}
    />
  )
}

export default App
