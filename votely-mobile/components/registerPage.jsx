import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FaceScanner from './faceScanner.jsx'
import { generateEmbedding, login, registerWithFace } from '../lib/api'
import { useAuth } from '../App.jsx'

function RegisterPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nik: '',
    fullName: '',
    dob: '',
    province: '',
    city: '',
    district: '',
    subDistrict: '',
    password: '',
    confirmPassword: '',
  })

  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [districts, setDistricts] = useState([])
  const [villages, setVillages] = useState([])
  const [selectedProvinceId, setSelectedProvinceId] = useState('')
  const [selectedRegencyId, setSelectedRegencyId] = useState('')
  const [selectedDistrictId, setSelectedDistrictId] = useState('')

  useEffect(() => {
    fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
      .then((res) => res.json())
      .then((data) => setProvinces(data))
      .catch(() => {})
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleProvinceChange = async (event) => {
    const provinceId = event.target.value
    const province = provinces.find((item) => item.id === provinceId)
    setSelectedProvinceId(provinceId)
    setForm((prev) => ({ ...prev, province: province?.name || '', city: '', district: '', subDistrict: '' }))
    setSelectedRegencyId('')
    setSelectedDistrictId('')
    setRegencies([])
    setDistricts([])
    setVillages([])
    if (!provinceId) return
    const data = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${provinceId}.json`).then((res) => res.json())
    setRegencies(data)
  }

  const handleRegencyChange = async (event) => {
    const regencyId = event.target.value
    const regency = regencies.find((item) => item.id === regencyId)
    setSelectedRegencyId(regencyId)
    setForm((prev) => ({ ...prev, city: regency?.name || '', district: '', subDistrict: '' }))
    setSelectedDistrictId('')
    setDistricts([])
    setVillages([])
    if (!regencyId) return
    const data = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${regencyId}.json`).then((res) => res.json())
    setDistricts(data)
  }

  const handleDistrictChange = async (event) => {
    const districtId = event.target.value
    const district = districts.find((item) => item.id === districtId)
    setSelectedDistrictId(districtId)
    setForm((prev) => ({ ...prev, district: district?.name || '', subDistrict: '' }))
    setVillages([])
    if (!districtId) return
    const data = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${districtId}.json`).then((res) => res.json())
    setVillages(data)
  }

  const handleVillageChange = (event) => {
    const villageId = event.target.value
    const village = villages.find((item) => item.id === villageId)
    setForm((prev) => ({ ...prev, subDistrict: village?.name || '' }))
  }

  const handleProceed = (event) => {
    event.preventDefault()
    setError('')

    if (!form.nik || !form.fullName || !form.dob || !form.province || !form.city || !form.district || !form.subDistrict) {
      setError('Semua field wajib diisi.')
      return
    }

    if (!form.password || form.password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Password konfirmasi tidak cocok.')
      return
    }

    setStep('face')
  }

  const handleFaceCapture = async (image) => {
    setLoading(true)
    setError('')
    try {
      const embeddingResponse = await generateEmbedding(image)
      if (!embeddingResponse?.embedding) {
        throw new Error(embeddingResponse?.error || 'Gagal memproses wajah.')
      }

      await registerWithFace({
        nik: form.nik,
        namaLengkap: form.fullName,
        password: form.password,
        dob: form.dob,
        provinsi: form.province,
        kabKota: form.city,
        kecamatan: form.district,
        kelurahan: form.subDistrict,
        faceEmbedding: embeddingResponse.embedding,
      })

      await login(form.nik, form.password)
      await refreshUser()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Registrasi gagal')
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen votely-bg px-6 py-10'>
      <div className='max-w-md mx-auto space-y-6'>
        <div className='space-y-2 text-center'>
          <img src='/userlogo.png' alt='Votely' className='h-12 mx-auto' />
          <h1 className='text-2xl font-bold text-slate-800'>Daftar Akun</h1>
          <p className='text-sm text-slate-500'>Lengkapi data dan verifikasi wajah Anda.</p>
        </div>

        {step === 'face' ? (
          <FaceScanner
            title='Registrasi Wajah'
            description='Ambil foto wajah Anda untuk verifikasi biometrik.'
            onCapture={handleFaceCapture}
            onCancel={() => setStep('form')}
            busy={loading}
            confirmLabel='Simpan Wajah'
          />
        ) : (
          <form onSubmit={handleProceed} className='glass-panel rounded-3xl border-glow p-6 space-y-4'>
            <div className='grid gap-4'>
              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>NIK</label>
                <input
                  name='nik'
                  value={form.nik}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                  placeholder='Masukkan NIK'
                />
              </div>
              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Nama Lengkap</label>
                <input
                  name='fullName'
                  value={form.fullName}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                  placeholder='Nama sesuai KTP'
                />
              </div>
              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Tanggal Lahir</label>
                <input
                  name='dob'
                  type='date'
                  value={form.dob}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                />
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Provinsi</label>
                <select
                  value={selectedProvinceId}
                  onChange={handleProvinceChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white'
                >
                  <option value=''>Pilih Provinsi</option>
                  {provinces.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Kota/Kabupaten</label>
                <select
                  value={selectedRegencyId}
                  onChange={handleRegencyChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white'
                >
                  <option value=''>Pilih Kota/Kabupaten</option>
                  {regencies.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Kecamatan</label>
                <select
                  value={selectedDistrictId}
                  onChange={handleDistrictChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white'
                >
                  <option value=''>Pilih Kecamatan</option>
                  {districts.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Kelurahan</label>
                <select
                  value={form.subDistrict ? villages.find((item) => item.name === form.subDistrict)?.id || '' : ''}
                  onChange={handleVillageChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white'
                >
                  <option value=''>Pilih Kelurahan</option>
                  {villages.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Password</label>
                <input
                  name='password'
                  type='password'
                  value={form.password}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                  placeholder='Buat password'
                />
              </div>
              <div className='space-y-2'>
                <label className='text-xs font-semibold text-slate-500'>Konfirmasi Password</label>
                <input
                  name='confirmPassword'
                  type='password'
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className='w-full rounded-xl border border-slate-200 px-4 py-3 text-sm'
                  placeholder='Ulangi password'
                />
              </div>
            </div>

            {error && <p className='text-sm text-red-600'>{error}</p>}

            <button type='submit' className='btn-primary w-full rounded-xl py-3 text-sm font-semibold'>
              Lanjut Verifikasi
            </button>

            <div className='text-sm text-slate-500 text-center'>
              Sudah punya akun?{' '}
              <Link to='/auth/login' className='font-semibold text-teal-600'>
                Masuk
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default RegisterPage
