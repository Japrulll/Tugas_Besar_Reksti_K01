import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromToken } from '@/lib/auth'
import { importElectionParticipants, parseVoterCsv } from '@/lib/voterCsv'

async function requireAdmin() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value
  if (!token) return null

  const user = await getCurrentUserFromToken(token)
  return user?.role === 'ADMIN' ? user : null
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''
    let csv = ''
    let electionId = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      const formElectionId = formData.get('electionId')
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'File CSV wajib diunggah.' }, { status: 400 })
      }
      csv = await file.text()
      electionId = typeof formElectionId === 'string' ? formElectionId : ''
    } else {
      const body = await request.json().catch(() => ({}))
      csv = typeof body.csv === 'string' ? body.csv : ''
      electionId = typeof body.electionId === 'string' ? body.electionId : ''
    }

    if (!electionId) {
      return NextResponse.json({ success: false, error: 'Election ID wajib diisi.' }, { status: 400 })
    }

    if (!csv.trim()) {
      return NextResponse.json({ success: false, error: 'Konten CSV kosong.' }, { status: 400 })
    }

    const election = await prisma.election.findUnique({
      where: { id: BigInt(electionId) },
      select: { id: true, deletedAt: true, createdBy: true },
    })
    if (!election || election.deletedAt || election.createdBy !== user.id) {
      return NextResponse.json({ success: false, error: 'Election tidak ditemukan.' }, { status: 404 })
    }

    const parsed = parseVoterCsv(csv)
    if (parsed.valid.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tidak ada peserta valid untuk diimport.',
          data: {
            totalRows: parsed.totalRows,
            imported: 0,
            created: 0,
            updated: 0,
            participants: 0,
            invalid: parsed.invalid,
            duplicates: parsed.duplicates,
          },
        },
        { status: 400 }
      )
    }

    const summary = await prisma.$transaction(async (tx) => {
      const result = await importElectionParticipants(tx, election.id, parsed)
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'IMPORT_ELECTION_PARTICIPANTS_CSV',
          entityType: 'Election',
          entityId: election.id.toString(),
          metadata: {
            totalRows: result.totalRows,
            imported: result.imported,
            created: result.created,
            updated: result.updated,
            participants: result.participants,
            duplicates: result.duplicates.length,
            invalid: result.invalid.length,
          },
        },
      })
      return result
    })

    const hasWarnings = summary.invalid.length > 0 || summary.duplicates.length > 0
    return NextResponse.json({
      success: true,
      message: hasWarnings ? 'Import peserta selesai dengan beberapa catatan.' : 'Import peserta berhasil.',
      data: summary,
    })
  } catch (error) {
    console.error('Error importing election participants CSV:', error)
    return NextResponse.json({ success: false, error: 'Gagal mengimport peserta.' }, { status: 500 })
  }
}
