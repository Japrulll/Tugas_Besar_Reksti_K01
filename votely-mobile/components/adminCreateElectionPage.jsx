import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAdminElection } from '../lib/api'

function AdminCreateElectionPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    level: 'NASIONAL',
    province: '',
    city: '',
    startTime: '',
    endTime: '',
  })
  const [candidates, setCandidates] = useState([
    { name: '', party: '', description: '', photoUrl: '' },
  ])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleCandidateChange = (index, field, value) => {
    setCandidates((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addCandidate = () => {
    setCandidates((prev) => [...prev, { name: '', party: '', description: '', photoUrl: '' }])
  }

  const removeCandidate = (index) => {
    setCandidates((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.name || !form.description || !form.startTime || !form.endTime) {
      setError('Nama, deskripsi, dan waktu wajib diisi.')
      return
    }

    if (candidates.some((candidate) => !candidate.name || !candidate.party)) {
      setError('Nama dan partai kandidat wajib diisi.')
      return
    }

    setLoading(true)
    try {
      await createAdminElection({
        name: form.name,
        description: form.description,
        level: form.level,
        province: form.level === 'NASIONAL' ? null : form.province,
        city: form.level === 'KOTA' ? form.city : null,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        candidates,
      })
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message || 'Gagal membuat pemilu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen votely-bg pb-20'>
      <div className='px-6 pt-8 space-y-6'>
        <button onClick={() => navigate('/admin')} className='text-xs font-semibold text-slate-500'>
          Kembali
        </button>

        <div className='glass-panel rounded-3xl border-glow p-6'>
          <h1 className='text-2xl font-bold text-slate-800'>Buat Pemilu Baru</h1>
          <p className='text-sm text-slate-500'>Masukkan detail pemilu dan kandidat.</p>
        </div>

        <form onSubmit={handleSubmit} className='glass-panel rounded-3xl border-glow p-6 space-y-4'>
          <div className='space-y-2'>
            <label className='text-xs font-semibold text-slate-500'>Nama Pemilu</label>
            <input
              name='name'
              value={form.name}
              onChange={handleChange}
              className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
              placeholder='Nama pemilu'
            />
          </div>
          <div className='space-y-2'>
            <label className='text-xs font-semibold text-slate-500'>Deskripsi</label>
            <textarea
              name='description'
              value={form.description}
              onChange={handleChange}
              className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
              rows='3'
              placeholder='Deskripsi singkat'
            />
          </div>
          <div className='space-y-2'>
            <label className='text-xs font-semibold text-slate-500'>Level</label>
            <select
              name='level'
              value={form.level}
              onChange={handleChange}
              className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white'
            >
              <option value='NASIONAL'>Nasional</option>
              <option value='PROVINSI'>Provinsi</option>
              <option value='KOTA'>Kota</option>
            </select>
          </div>
          {form.level !== 'NASIONAL' && (
            <div className='space-y-2'>
              <label className='text-xs font-semibold text-slate-500'>Provinsi</label>
              <input
                name='province'
                value={form.province}
                onChange={handleChange}
                className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                placeholder='Nama provinsi'
              />
            </div>
          )}
          {form.level === 'KOTA' && (
            <div className='space-y-2'>
              <label className='text-xs font-semibold text-slate-500'>Kota/Kabupaten</label>
              <input
                name='city'
                value={form.city}
                onChange={handleChange}
                className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                placeholder='Nama kota/kabupaten'
              />
            </div>
          )}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <label className='text-xs font-semibold text-slate-500'>Mulai</label>
              <input
                type='datetime-local'
                name='startTime'
                value={form.startTime}
                onChange={handleChange}
                className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
              />
            </div>
            <div className='space-y-2'>
              <label className='text-xs font-semibold text-slate-500'>Selesai</label>
              <input
                type='datetime-local'
                name='endTime'
                value={form.endTime}
                onChange={handleChange}
                className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
              />
            </div>
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h2 className='text-base font-semibold text-slate-800'>Kandidat</h2>
              <button type='button' onClick={addCandidate} className='text-xs font-semibold text-teal-600'>
                Tambah
              </button>
            </div>

            {candidates.map((candidate, index) => (
              <div key={index} className='rounded-2xl border border-slate-200 p-4 space-y-2 bg-white/70'>
                <div className='flex items-center justify-between'>
                  <p className='text-sm font-semibold text-slate-700'>Kandidat {index + 1}</p>
                  {candidates.length > 1 && (
                    <button type='button' onClick={() => removeCandidate(index)} className='text-xs text-red-500'>
                      Hapus
                    </button>
                  )}
                </div>
                <input
                  value={candidate.name}
                  onChange={(event) => handleCandidateChange(index, 'name', event.target.value)}
                  className='w-full rounded-xl border border-slate-200 px-4 py-2 text-sm'
                  placeholder='Nama kandidat'
                />
                <input
                  value={candidate.party}
                  onChange={(event) => handleCandidateChange(index, 'party', event.target.value)}
                  className='w-full rounded-xl border border-slate-200 px-4 py-2 text-sm'
                  placeholder='Partai'
                />
                <input
                  value={candidate.description}
                  onChange={(event) => handleCandidateChange(index, 'description', event.target.value)}
                  className='w-full rounded-xl border border-slate-200 px-4 py-2 text-sm'
                  placeholder='Deskripsi singkat'
                />
                <input
                  value={candidate.photoUrl}
                  onChange={(event) => handleCandidateChange(index, 'photoUrl', event.target.value)}
                  className='w-full rounded-xl border border-slate-200 px-4 py-2 text-sm'
                  placeholder='URL foto (opsional)'
                />
              </div>
            ))}
          </div>

          {error && <p className='text-sm text-red-600'>{error}</p>}

          <button
            type='submit'
            disabled={loading}
            className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'
          >
            {loading ? 'Membuat...' : 'Buat & Deploy'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminCreateElectionPage
