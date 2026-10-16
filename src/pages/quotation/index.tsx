import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  closeNotification,
  showConfirm,
  showError,
  showInfo,
  showLoading,
  showSuccess,
  showTextInput,
  showWarning,
} from '@/utils/notifications'
import {
  CalendarDays,
  ChevronDown,
  Eye,
  Filter,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

type QuotationStatus =
  | 'Draft'
  | 'Sent'
  | 'Follow Up'
  | 'Approved'
  | 'Rejected'
  | 'Revised'

type QuotationType = 'Barang' | 'Jasa' | 'Barang & Jasa'
type FollowUpStatus = 'Belum dijadwalkan' | 'Terjadwal' | 'Selesai' | 'Jatuh tempo'

type QuotationItem = {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  discount?: number
  taxRate?: number
  subtotal?: number
}

type QuotationRecord = {
  id: string
  recipient: string
  address: string
  city: string
  date: string
  number: string
  validityDays: string
  senderCompany: string
  introduction: string
  signer: string
  position: string
  email: string
  phone: string
  taxEnabled: boolean
  taxMode: string
  taxRate: number
  taxManualAmount: number
  signatureImage?: string | null
  stampImage?: string | null
  type: QuotationType
  status: QuotationStatus
  title: string | null
  validUntil: string | null
  notes: string | null
  followUpDate: string | null
  followUpStatus: FollowUpStatus
  followUpNotes: string | null
  createdAt: string
  updatedAt: string
  items: QuotationItem[]
  attachments?: Array<{ id: string; name: string; url: string; mimeType: string; size: number }>
}

type QuotationDraft = Omit<QuotationRecord, 'createdAt' | 'updatedAt' | 'items' | 'attachments'> & {
  items: QuotationItem[]
}

const statusOptions: QuotationStatus[] = ['Draft', 'Sent', 'Follow Up', 'Approved', 'Rejected', 'Revised']
const statusLabels: Record<QuotationStatus, string> = {
  Draft: 'Draft',
  Sent: 'Terkirim',
  'Follow Up': 'Perlu tindak lanjut',
  Approved: 'Disetujui',
  Rejected: 'Ditolak',
  Revised: 'Direvisi',
}
const typeOptions: QuotationType[] = ['Barang', 'Jasa', 'Barang & Jasa']
const followUpOptions: FollowUpStatus[] = ['Belum dijadwalkan', 'Terjadwal', 'Selesai', 'Jatuh tempo']

const localFallbackKey = 'luma-quotation-manager'

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

function formatDate(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function getDefaultItem(): QuotationItem {
  return {
    id: uid(),
    description: '',
    quantity: 1,
    unit: 'pcs',
    unitPrice: 0,
    discount: 0,
    taxRate: 0,
    subtotal: 0,
  }
}

function createDraftNumber(rows: QuotationRecord[]) {
  const year = new Date().getFullYear()
  const filtered = rows.filter((item) => item.number.startsWith(`QT-${year}-`))
  const count = filtered.length + 1
  return `QT-${year}-${String(count).padStart(3, '0')}`
}

function createEmptyDraft(rows: QuotationRecord[]): QuotationDraft {
  return {
    id: '',
    recipient: '',
    address: '',
    city: '',
    date: new Date().toISOString().slice(0, 10),
    number: createDraftNumber(rows),
    validityDays: '30',
    senderCompany: 'PT Luma',
    introduction: '',
    signer: '',
    position: '',
    email: '',
    phone: '',
    taxEnabled: true,
    taxMode: 'manual',
    taxRate: 11,
    taxManualAmount: 0,
    signatureImage: null,
    stampImage: null,
    type: 'Barang & Jasa',
    status: 'Draft',
    title: '',
    validUntil: '',
    notes: '',
    followUpDate: '',
    followUpStatus: 'Belum dijadwalkan',
    followUpNotes: '',
    items: [getDefaultItem()],
  }
}

function getStatusClass(status: QuotationStatus) {
  switch (status) {
    case 'Draft':
      return 'bg-slate-200 text-slate-700'
    case 'Sent':
      return 'bg-blue-100 text-blue-700'
    case 'Follow Up':
      return 'bg-amber-100 text-amber-700'
    case 'Approved':
      return 'bg-emerald-100 text-emerald-700'
    case 'Rejected':
      return 'bg-rose-100 text-rose-700'
    case 'Revised':
      return 'bg-cyan-100 text-cyan-800'
    default:
      return 'bg-slate-200 text-slate-700'
  }
}

function getFollowUpClass(status: FollowUpStatus) {
  switch (status) {
    case 'Belum dijadwalkan':
      return 'bg-slate-200 text-slate-700'
    case 'Terjadwal':
      return 'bg-blue-100 text-blue-700'
    case 'Jatuh tempo':
      return 'bg-orange-100 text-orange-700'
    case 'Selesai':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-slate-200 text-slate-700'
  }
}

function calculateLineTotal(item: QuotationItem) {
  const base = item.quantity * item.unitPrice - (item.discount ?? 0)
  const tax = base * ((item.taxRate ?? 0) / 100)
  return base + tax
}

function getSummaryTotals(items: QuotationItem[]) {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0)
}

function flattenForExport(rows: QuotationRecord[]) {
  return rows.map((item) => ({
    'No. Quotation': item.number,
    'Penerima / Customer': item.recipient,
    Type: item.type,
    Date: formatDate(item.date),
    Status: item.status,
    'Follow Up Date': formatDate(item.followUpDate),
    'Follow Up Status': item.followUpStatus,
    Deskripsi: item.title || item.introduction || '-',
    Subtotal: getSummaryTotals(item.items),
    Total: getSummaryTotals(item.items),
    'Nomor PO terkait': '-',
    'Dibuat': formatDate(item.createdAt),
    'Diperbarui': formatDate(item.updatedAt),
  }))
}

export default function QuotationPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<QuotationRecord[]>([])
  const [selected, setSelected] = useState<QuotationRecord | null>(null)
  const [draft, setDraft] = useState<QuotationDraft>(() => createEmptyDraft([]))
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isStatusEditorOpen, setIsStatusEditorOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const [typeFilter, setTypeFilter] = useState('Semua')
  const [followUpFilter, setFollowUpFilter] = useState('Semua')
  const [dateFilter, setDateFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  const loadRows = async (notifyError = true) => {
    setLoading(true)

    try {
      const response = await fetch('http://localhost:3001/api/quotations')
      if (!response.ok) {
        throw new Error('Gagal memuat quotation')
      }
      const data = await response.json()
      setRows(data)
      try {
        localStorage.setItem(localFallbackKey, JSON.stringify(data))
      } catch {
        // The backend data remains available in memory without a local cache.
      }
    } catch {
      let cached: string | null = null
      try {
        cached = localStorage.getItem(localFallbackKey)
      } catch {
        cached = null
      }
      let fallback: QuotationRecord[] = []
      try {
        fallback = cached ? JSON.parse(cached) : []
      } catch {
        localStorage.removeItem(localFallbackKey)
      }
      setRows(fallback)
      if (notifyError) {
        await showWarning(
          'Backend tidak dapat dihubungi',
          fallback.length
            ? 'Data lokal ditampilkan. Perubahan belum tersinkron dengan backend.'
            : 'Data quotation belum dapat dimuat. Periksa koneksi backend lalu coba lagi.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rows.filter((item) => {
      const matchesSearch =
        !term ||
        item.number.toLowerCase().includes(term) ||
        item.recipient.toLowerCase().includes(term) ||
        item.title?.toLowerCase().includes(term) ||
        item.introduction.toLowerCase().includes(term)

      const matchesStatus = statusFilter === 'Semua' || item.status === statusFilter
      const matchesType = typeFilter === 'Semua' || item.type === typeFilter
      const matchesFollowUp =
        followUpFilter === 'Semua' ||
        (followUpFilter === 'Belum dijadwalkan' && item.followUpStatus === 'Belum dijadwalkan') ||
        (followUpFilter === 'Terjadwal' && item.followUpStatus === 'Terjadwal') ||
        (followUpFilter === 'Jatuh tempo' && item.followUpStatus === 'Jatuh tempo') ||
        (followUpFilter === 'Selesai' && item.followUpStatus === 'Selesai')

      let matchesDate = true
      if (dateFilter !== 'all') {
        const today = new Date()
        const target = new Date(item.date)
        if (dateFilter === 'today') {
          matchesDate = target.toDateString() === today.toDateString()
        } else if (dateFilter === '7days') {
          const diff = Math.floor((today.getTime() - target.getTime()) / 86400000)
          matchesDate = diff >= 0 && diff <= 7
        } else if (dateFilter === '30days') {
          const diff = Math.floor((today.getTime() - target.getTime()) / 86400000)
          matchesDate = diff >= 0 && diff <= 30
        }
      }
      const matchesDateRange = (!dateFrom || item.date >= dateFrom) && (!dateTo || item.date <= dateTo)

      return matchesSearch && matchesStatus && matchesType && matchesFollowUp && matchesDate && matchesDateRange
    })
  }, [rows, search, statusFilter, typeFilter, followUpFilter, dateFilter, dateFrom, dateTo])

  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const stats = useMemo(() => {
    return {
      total: rows.length,
      draft: rows.filter((item) => item.status === 'Draft').length,
      followUp: rows.filter((item) => item.status === 'Follow Up' || item.followUpStatus === 'Jatuh tempo').length,
    }
  }, [rows])

  const activeFilterCount = [
    statusFilter !== 'Semua',
    typeFilter !== 'Semua',
    followUpFilter !== 'Semua',
    dateFilter !== 'all',
    Boolean(dateFrom || dateTo),
  ].filter(Boolean).length

  const openCreateForm = () => {
    setIsEditing(false)
    setDraft(createEmptyDraft(rows))
    setIsFormOpen(true)
  }

  const openEditForm = (record: QuotationRecord) => {
    setIsEditing(true)
    setDraft({
      ...record,
      id: record.id,
      title: record.title ?? '',
      notes: record.notes ?? '',
      validUntil: record.validUntil ?? '',
      followUpDate: record.followUpDate ?? '',
      followUpNotes: record.followUpNotes ?? '',
      items: record.items.map((item) => ({ ...item, id: item.id ?? uid() })),
    })
    setIsFormOpen(true)
  }

  const handleSaveQuotation = async () => {
    if (!draft.number.trim() || !draft.recipient.trim()) {
      await showWarning('Data belum lengkap', 'Isi nomor quotation dan nama penerima/customer terlebih dahulu.')
      return
    }

    const payload = {
      ...draft,
      items: draft.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        discount: Number(item.discount || 0),
        taxRate: Number(item.taxRate || 0),
      })),
    }

    showLoading(isEditing ? 'Menyimpan perubahan...' : 'Membuat quotation...')
    try {
      const response = await fetch(
        isEditing ? `http://localhost:3001/api/quotations/${draft.id}` : 'http://localhost:3001/api/quotations',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(errorBody?.error || 'Gagal menyimpan quotation')
      }

      const savedRecord = (await response.json()) as QuotationRecord
      let cachedRows: QuotationRecord[] = []
      try {
        cachedRows = JSON.parse(localStorage.getItem(localFallbackKey) || '[]') as QuotationRecord[]
      } catch {
        cachedRows = []
      }
      const nextRows = isEditing
        ? cachedRows.some((item) => item.id === savedRecord.id)
          ? cachedRows.map((item) => (item.id === savedRecord.id ? savedRecord : item))
          : [savedRecord, ...cachedRows]
        : [savedRecord, ...cachedRows.filter((item) => item.id !== savedRecord.id)]
      setRows(nextRows)
      try {
        localStorage.setItem(localFallbackKey, JSON.stringify(nextRows))
      } catch {
        // The backend remains the source of truth when local caching is unavailable.
      }
      closeNotification()
      setIsFormOpen(false)
      await showSuccess(isEditing ? 'Quotation berhasil diperbarui' : 'Quotation berhasil dibuat')
    } catch (error) {
      closeNotification()
      await showError(
        'Quotation belum tersimpan',
        error instanceof Error
          ? `${error.message} Data formulir tetap terbuka agar Anda dapat mencoba lagi.`
          : 'Backend tidak dapat menyimpan perubahan. Data formulir tetap terbuka agar Anda dapat mencoba lagi.',
      )
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('Hapus quotation?', 'Tindakan ini tidak dapat dibatalkan.', 'Ya, hapus'))) {
      return
    }

    try {
      showLoading('Menghapus quotation...')
      const response = await fetch(`http://localhost:3001/api/quotations/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Gagal menghapus quotation')
      }
      const nextRows = rows.filter((item) => item.id !== id)
      setRows(nextRows)
      try {
        localStorage.setItem(localFallbackKey, JSON.stringify(nextRows))
      } catch {
        // The backend remains the source of truth when local caching is unavailable.
      }
      closeNotification()
      await showSuccess('Quotation berhasil dihapus')
    } catch {
      closeNotification()
      await showError('Quotation belum terhapus', 'Backend belum berhasil menghapus data. Quotation tetap ditampilkan.')
    }
  }

  const updateTransactionStatus = async (record: QuotationRecord, nextStatus: QuotationStatus) => {
    if (nextStatus === record.status || updatingStatusId !== null) return
    setUpdatingStatusId(record.id)
    const confirmed = await showConfirm(
      'Ubah status transaksi?',
      `Status ${record.number} akan diubah dari “${statusLabels[record.status]}” menjadi “${statusLabels[nextStatus]}”.`,
      'Ya, ubah status',
    )
    if (!confirmed) {
      setUpdatingStatusId(null)
      return
    }

    showLoading('Menyimpan status transaksi...')
    try {
      const response = await fetch(`http://localhost:3001/api/quotations/${record.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(errorBody?.error || 'Status transaksi belum berhasil disimpan.')
      }

      const savedStatus = await response.json() as { status: QuotationStatus; updatedAt: string }
      const updated = { ...record, status: savedStatus.status, updatedAt: savedStatus.updatedAt }
      const nextRows = rows.map((row) => row.id === record.id ? updated : row)
      setRows(nextRows)
      setSelected((current) => current?.id === record.id ? updated : current)
      try {
        localStorage.setItem(localFallbackKey, JSON.stringify(nextRows))
      } catch {
        // Backend remains the source of truth when local cache is unavailable.
      }
      closeNotification()
      setIsStatusEditorOpen(false)
      await showSuccess('Status transaksi berhasil diperbarui', `${record.number}: ${statusLabels[nextStatus]}`)
    } catch (error) {
      closeNotification()
      await showError(
        'Status transaksi belum berubah',
        error instanceof Error ? error.message : 'Periksa koneksi backend lalu coba kembali.',
      )
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const exportToExcel = () => {
    if (!filteredRows.length) {
      void showInfo('Tidak ada data quotation', 'Sesuaikan filter atau tambahkan quotation sebelum mengekspor.')
      return
    }

    try {
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(flattenForExport(filteredRows))
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation')
      XLSX.writeFile(workbook, `quotation-${new Date().toISOString().slice(0, 10)}.xlsx`)
      void showSuccess('File Excel quotation berhasil dibuat')
    } catch {
      void showError('Ekspor gagal', 'File Excel quotation tidak dapat dibuat. Silakan coba kembali.')
    }
  }

  const createQuickIn = async () => {
    const poNumber = await showTextInput('Catat PO masuk', 'Nomor PO pelanggan')
    if (!poNumber) return
    const recipient = selected?.recipient || await showTextInput('Catat PO masuk', 'Nama customer / penerima PO')
    if (!recipient) return

    try {
      showLoading('Menyimpan PO...')
      const response = await fetch('http://localhost:3001/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNumber,
          date: new Date().toISOString().slice(0, 10),
          receivedAt: new Date().toISOString().slice(0, 10),
          recipient,
          quotationId: selected?.id || null,
          notes: 'PO masuk cepat dari halaman Quotation.',
        }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'PO tidak berhasil disimpan.')
      closeNotification()
      await showSuccess('PO In / Quick In berhasil disimpan ke database')
    } catch (error) {
      closeNotification()
      await showError('PO belum berhasil disimpan', error instanceof Error ? error.message : 'Periksa koneksi backend lalu coba kembali.')
    }
  }

  const uploadAttachment = async (file: File | null) => {
    if (!file || !selected) return
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/webp',
    ]
    if (!allowedTypes.includes(file.type)) {
      await showWarning('Format file tidak didukung', 'Gunakan file PDF, DOCX, XLSX, PNG, JPG, atau WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      await showWarning('Ukuran file terlalu besar', 'Ukuran maksimal lampiran adalah 10 MB.')
      return
    }

    setIsAttachmentUploading(true)
    showLoading('Mengunggah lampiran...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`http://localhost:3001/api/quotations/${selected.id}/attachments`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Unggah lampiran gagal')
      const attachment = (await response.json()) as NonNullable<QuotationRecord['attachments']>[number]
      const nextAttachments = [attachment, ...(selected.attachments ?? [])]
      const nextSelected = { ...selected, attachments: nextAttachments }
      setSelected(nextSelected)
      setRows((current) => current.map((row) => (row.id === selected.id ? nextSelected : row)))
      try {
        localStorage.setItem(
          localFallbackKey,
          JSON.stringify(rows.map((row) => (row.id === selected.id ? nextSelected : row))),
        )
      } catch {
        // The backend remains the source of truth when local caching is unavailable.
      }
      closeNotification()
      await showSuccess('Lampiran berhasil diunggah')
    } catch {
      closeNotification()
      await showError('Unggah lampiran gagal', 'Periksa koneksi backend dan coba kembali.')
    } finally {
      setIsAttachmentUploading(false)
    }
  }

  const deleteAttachment = async (attachmentId: string) => {
    if (!selected) return
    if (!(await showConfirm('Hapus lampiran?', 'Lampiran ini akan dihapus dari quotation.', 'Ya, hapus'))) return

    showLoading('Menghapus lampiran...')
    try {
      const response = await fetch(
        `http://localhost:3001/api/quotations/${selected.id}/attachments/${attachmentId}`,
        { method: 'DELETE' },
      )
      if (!response.ok) throw new Error('Hapus lampiran gagal')
      const nextSelected = {
        ...selected,
        attachments: (selected.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
      }
      setSelected(nextSelected)
      const nextRows = rows.map((row) => (row.id === selected.id ? nextSelected : row))
      setRows(nextRows)
      try {
        localStorage.setItem(localFallbackKey, JSON.stringify(nextRows))
      } catch {
        // The backend remains the source of truth when local caching is unavailable.
      }
      closeNotification()
      await showSuccess('Lampiran berhasil dihapus')
    } catch {
      closeNotification()
      await showError('Hapus lampiran gagal', 'Periksa koneksi backend dan coba kembali.')
    }
  }

  const updateDraftItem = (index: number, field: keyof QuotationItem, value: string | number) => {
    setDraft((current) => {
      const nextItems = [...current.items]
      const item = nextItems[index]
      nextItems[index] = {
        ...item,
        [field]:
          field === 'quantity' || field === 'unitPrice' || field === 'discount' || field === 'taxRate'
            ? Number(value || 0)
            : value,
      }
      nextItems[index].subtotal = calculateLineTotal(nextItems[index])
      return { ...current, items: nextItems }
    })
  }

  const addItem = () => {
    setDraft((current) => ({ ...current, items: [...current.items, getDefaultItem()] }))
  }

  const removeItem = async (index: number) => {
    if (!(await showConfirm('Hapus item penawaran?', 'Item ini akan dihapus dari draft quotation.', 'Ya, hapus'))) return
    setDraft((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((_, idx) => idx !== index) : [getDefaultItem()],
    }))
  }

  return (
    <div className="scrollbar flex h-full w-full min-w-0 flex-col gap-24 overflow-auto py-8">
      <div className="flex items-center justify-between gap-24 phones:flex-col phones:items-start">
        <div>
          <p className="text-[2.8rem] font-bold text-slate-800">Quotation</p>
          <p className="text-slate-500">Kelola dan pantau seluruh dokumen penawaran.</p>
        </div>
        <div className="flex flex-wrap gap-12">
          <button onClick={openCreateForm} className="inline-flex min-h-[4.2rem] items-center justify-center gap-8 rounded-xl bg-app-primary px-16 py-10 text-[1.6rem] font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary focus-visible:ring-offset-2">
            <Plus size={18} />
            Create New
          </button>
          <button onClick={createQuickIn} className="inline-flex min-h-[4.2rem] items-center justify-center gap-8 rounded-xl border border-slate-300 bg-white px-16 py-10 text-[1.6rem] font-medium text-slate-700 hover:bg-slate-50">
            <FileText size={18} />
            PO In / Quick In
          </button>
          <button onClick={exportToExcel} className="inline-flex min-h-[4.2rem] items-center justify-center gap-8 rounded-xl border border-emerald-300 bg-emerald-50 px-16 py-10 text-[1.6rem] font-medium text-emerald-800 hover:bg-emerald-100">
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-16 phones:grid-cols-1">
        <StatCard title="Total Quotation" value={stats.total} />
        <StatCard title="Draft" value={stats.draft} />
        <StatCard title={statusLabels['Follow Up']} value={stats.followUp} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-20 shadow-sm">
        <div className="flex flex-col gap-12">
          <div className="flex flex-wrap items-center gap-12">
            <label className="relative w-full max-w-[38rem]">
              <Search className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                placeholder="Cari nomor quotation atau penerima/customer"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-12 pl-40 pr-12 text-[1.8rem]"
              />
            </label>
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex min-h-[4.4rem] items-center gap-8 rounded-xl border border-slate-300 bg-white px-12 py-10 text-[1.6rem] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Filter size={16} />
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              <ChevronDown className={clsx('transition-transform', filtersOpen && 'rotate-180')} size={16} />
            </button>
          </div>
          {!loading && <div className="text-[1.5rem] text-slate-500">{filteredRows.length} dari {rows.length} quotation</div>}

          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-12 border-t border-slate-100 pt-12">
            <select aria-label="Filter status transaksi" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-300 bg-white px-12 py-12 text-[1.8rem]">
              <option>Semua</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
            <select aria-label="Filter jenis penawaran" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-300 bg-white px-12 py-12 text-[1.8rem]">
              <option>Semua</option>
              {typeOptions.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <select aria-label="Filter tanggal quotation" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-300 bg-white px-12 py-12 text-[1.8rem]">
              <option value="all">Semua tanggal</option>
              <option value="today">Hari ini</option>
              <option value="7days">7 hari terakhir</option>
              <option value="30days">30 hari terakhir</option>
            </select>
            <label className="flex items-center gap-8 rounded-xl border border-slate-300 bg-white px-12 py-8 text-[1.4rem] text-slate-600">
              <input aria-label="Tanggal mulai quotation" title="Tanggal mulai quotation" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="min-w-0 bg-transparent text-[1.5rem] text-slate-800" />
            </label>
            <label className="flex items-center gap-8 rounded-xl border border-slate-300 bg-white px-12 py-8 text-[1.4rem] text-slate-600">
              <input aria-label="Tanggal akhir quotation" title="Tanggal akhir quotation" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="min-w-0 bg-transparent text-[1.5rem] text-slate-800" />
            </label>
            <select aria-label="Filter tindak lanjut" value={followUpFilter} onChange={(e) => { setFollowUpFilter(e.target.value); setPage(1) }} className="rounded-xl border border-slate-300 bg-white px-12 py-12 text-[1.8rem]">
              <option>Semua</option>
              {followUpOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('Semua')
                setTypeFilter('Semua')
                setFollowUpFilter('Semua')
                setDateFilter('all')
                setDateFrom('')
                setDateTo('')
                setPage(1)
              }}
              className="rounded-xl border border-slate-300 bg-white px-12 py-12 text-[1.8rem]"
            >
              Reset Filter
            </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[110rem] w-full text-left">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-16 font-semibold">No. Quotation</th>
                <th className="p-16 font-semibold">Penerima / Customer</th>
                <th className="p-16 font-semibold">Jenis Penawaran</th>
                <th className="p-16 font-semibold">Tanggal Quotation</th>
                <th className="p-16 font-semibold">Status Transaksi</th>
                <th className="p-16 font-semibold">Tindak Lanjut</th>
                <th className="p-16 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-24 text-center text-slate-500">Memuat quotation…</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-24 text-center text-slate-500">
                    Tidak ada quotation yang sesuai dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="p-16 font-medium text-slate-700">
                      <button onClick={() => { setSelected(row); setIsDetailOpen(true); setIsStatusEditorOpen(false) }} className="text-left font-semibold text-blue-600 hover:underline">
                        {row.number}
                      </button>
                    </td>
                    <td className="p-16 text-slate-700">{row.recipient}</td>
                    <td className="p-16 text-slate-700">{row.type}</td>
                    <td className="p-16 text-slate-700">{formatDate(row.date)}</td>
                    <td className="p-16">
                      <span className={clsx('inline-flex rounded-full px-12 py-6 text-[1.3rem] font-medium', getStatusClass(row.status))}>{statusLabels[row.status]}</span>
                    </td>
                    <td className="p-16">
                      {(() => {
                        const today = new Date().toLocaleDateString('sv-SE')
                        const isOverdue = Boolean(row.followUpDate && row.followUpDate < today && row.followUpStatus !== 'Selesai')
                        const label = isOverdue
                          ? `Terlambat · ${formatDate(row.followUpDate)}`
                          : row.followUpStatus === 'Selesai'
                            ? 'Selesai'
                            : row.followUpDate
                              ? formatDate(row.followUpDate)
                              : row.followUpStatus === 'Jatuh tempo'
                                ? 'Terlambat'
                                : row.followUpStatus
                        return <span className={clsx('inline-flex rounded-full px-10 py-4 text-[1.3rem] font-medium', getFollowUpClass(isOverdue ? 'Jatuh tempo' : row.followUpStatus))}>{label}</span>
                      })()}
                    </td>
                    <td className="p-16">
                      <div className="grid min-w-[23rem] grid-cols-2 gap-6">
                        <button type="button" aria-label={`Lihat detail ${row.number}`} title="Lihat detail" onClick={() => { setSelected(row); setIsDetailOpen(true); setIsStatusEditorOpen(false) }} className="inline-flex min-h-[3.6rem] items-center gap-6 px-8 text-left text-[1.2rem] font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary">
                          <Eye aria-hidden="true" className="shrink-0" size={16} /><span>Detail</span>
                        </button>
                        <button type="button" aria-label={`Edit ${row.number}`} title="Edit quotation" onClick={() => openEditForm(row)} className="inline-flex min-h-[3.6rem] items-center gap-6 px-8 text-left text-[1.2rem] font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary">
                          <Pencil aria-hidden="true" className="shrink-0" size={16} /><span>Edit</span>
                        </button>
                        <button type="button" aria-label={`Buat Surat Penawaran ${row.number}`} title="Buat Surat Penawaran" onClick={() => navigate('/surat/surat-penawaran', { state: { quotation: row } })} className="inline-flex min-h-[3.6rem] items-center gap-6 px-8 text-left text-[1.2rem] font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary">
                          <FileText aria-hidden="true" className="shrink-0" size={16} /><span>Surat</span>
                        </button>
                        <button type="button" aria-label={`Kelola lampiran ${row.number}`} title="Kelola lampiran" onClick={() => { setSelected(row); setIsDetailOpen(true); setIsStatusEditorOpen(false) }} className="inline-flex min-h-[3.6rem] items-center gap-6 px-8 text-left text-[1.2rem] font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary">
                          <Paperclip aria-hidden="true" className="shrink-0" size={16} /><span>Lampiran</span>
                        </button>
                        <button type="button" aria-label={`Hapus ${row.number}`} title="Hapus quotation" onClick={() => void handleDelete(row.id)} className="inline-flex min-h-[3.6rem] items-center gap-6 px-8 text-left text-[1.2rem] font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary">
                          <Trash2 aria-hidden="true" className="shrink-0" size={16} /><span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRows.length > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-12 rounded-xl border border-slate-200 bg-white px-16 py-12">
          <span className="text-[1.5rem] text-slate-500">
            Menampilkan {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRows.length)} dari {filteredRows.length} quotation
          </span>
          <div className="flex items-center gap-8">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-300 px-12 py-8 text-[1.5rem] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="px-8 text-[1.5rem] text-slate-600">Halaman {currentPage} dari {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              disabled={currentPage === pageCount}
              className="rounded-lg border border-slate-300 px-12 py-8 text-[1.5rem] text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-24">
          <div className="max-h-[90vh] w-full max-w-[120rem] overflow-auto rounded-3xl bg-white p-24 shadow-2xl">
            <div className="mb-20 flex items-center justify-between">
              <div>
                <p className="text-[2.6rem] font-bold">{isEditing ? 'Edit Quotation' : 'Create New Quotation'}</p>
                <p className="text-slate-500">Simpan data quotation dan item terkait.</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="rounded-full bg-slate-100 p-10 text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-16 desktop:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-16">
                <h2 className="mb-14 text-[1.8rem] font-semibold text-slate-800">Informasi Quotation</h2>
                <div className="space-y-12">
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Nomor Quotation</span>
                  <input value={draft.number} onChange={(e) => setDraft((current) => ({ ...current, number: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Type</span>
                  <select value={draft.type} onChange={(e) => setDraft((current) => ({ ...current, type: e.target.value as QuotationType }))} className="w-full rounded-xl border border-slate-300 px-12 py-10">
                    {typeOptions.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Tanggal</span>
                  <input type="date" value={draft.date} onChange={(e) => setDraft((current) => ({ ...current, date: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Berlaku sampai</span>
                  <input type="date" value={draft.validUntil || ''} onChange={(e) => setDraft((current) => ({ ...current, validUntil: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Judul / Deskripsi Penawaran</span>
                  <input value={draft.title || ''} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Status Transaksi</span>
                  <select value={draft.status} onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value as QuotationStatus }))} className="w-full rounded-xl border border-slate-300 px-12 py-10">
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{statusLabels[status]}</option>
                    ))}
                  </select>
                </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-16">
                <h2 className="mb-14 text-[1.8rem] font-semibold text-slate-800">Informasi Penerima</h2>
                <div className="space-y-12">
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Nama Penerima / Customer</span>
                  <input value={draft.recipient} onChange={(e) => setDraft((current) => ({ ...current, recipient: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Alamat</span>
                  <input value={draft.address} onChange={(e) => setDraft((current) => ({ ...current, address: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Kota</span>
                  <input value={draft.city} onChange={(e) => setDraft((current) => ({ ...current, city: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Email</span>
                  <input value={draft.email} onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Telepon</span>
                  <input value={draft.phone} onChange={(e) => setDraft((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                <label className="block">
                  <span className="mb-6 block text-[1.7rem] font-medium">Catatan internal</span>
                  <textarea value={draft.notes || ''} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} rows={4} className="w-full rounded-xl border border-slate-300 px-12 py-10" />
                </label>
                </div>
              </section>
            </div>

            <section className="mt-20 rounded-2xl border border-slate-200 bg-slate-50 p-16">
              <div className="mb-12 flex items-center justify-between">
                <div>
                  <h2 className="text-[2rem] font-semibold">Item Penawaran</h2>
                  <p className="mt-4 text-[1.4rem] text-slate-500">Isi rincian barang atau jasa yang ditawarkan.</p>
                </div>
                <button onClick={addItem} className="min-h-[3.8rem] rounded-xl bg-app-primary px-12 py-8 text-[1.5rem] font-semibold text-white hover:bg-blue-800">Tambah Item</button>
              </div>
              <div className="space-y-12">
                {draft.items.map((item, index) => (
                  <div key={item.id} className="grid min-w-0 gap-12 rounded-xl border border-slate-200 bg-white p-12 laptop:grid-cols-7 desktop:grid-cols-7">
                    <label className="min-w-0 laptop:col-span-2 desktop:col-span-2">
                      <span className="mb-4 block text-[1.3rem] font-medium text-slate-600">Barang / Jasa</span>
                      <input placeholder="Nama barang/jasa" value={item.description} onChange={(e) => updateDraftItem(index, 'description', e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-10 py-8" />
                    </label>
                    <label>
                      <span className="mb-4 block text-[1.3rem] font-medium text-slate-600">Jumlah</span>
                      <input aria-label={`Jumlah item ${index + 1}`} type="number" min={1} value={item.quantity} onChange={(e) => updateDraftItem(index, 'quantity', e.target.value)} className="w-full rounded-lg border border-slate-300 px-10 py-8" />
                    </label>
                    <label>
                      <span className="mb-4 block text-[1.3rem] font-medium text-slate-600">Satuan</span>
                      <input placeholder="pcs" value={item.unit} onChange={(e) => updateDraftItem(index, 'unit', e.target.value)} className="w-full rounded-lg border border-slate-300 px-10 py-8" />
                    </label>
                    <label>
                      <span className="mb-4 block text-[1.3rem] font-medium text-slate-600">Harga Satuan</span>
                      <input aria-label={`Harga satuan item ${index + 1}`} type="number" min={0} value={item.unitPrice} onChange={(e) => updateDraftItem(index, 'unitPrice', e.target.value)} className="w-full rounded-lg border border-slate-300 px-10 py-8" />
                    </label>
                    <label>
                      <span className="mb-4 block text-[1.3rem] font-medium text-slate-600">Diskon</span>
                      <input aria-label={`Diskon item ${index + 1}`} type="number" min={0} value={item.discount ?? 0} onChange={(e) => updateDraftItem(index, 'discount', e.target.value)} className="w-full rounded-lg border border-slate-300 px-10 py-8" />
                    </label>
                    <div className="flex items-end gap-8">
                      <div className="min-w-0 flex-1">
                        <span className="mb-4 block text-[1.3rem] font-medium text-slate-600">Total</span>
                        <span className="block truncate text-[1.4rem] font-semibold text-slate-800">{formatCurrency(calculateLineTotal(item))}</span>
                      </div>
                      <button onClick={() => removeItem(index)} className="ml-auto rounded-lg bg-rose-100 p-8 text-rose-700">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-24 flex justify-end gap-12">
              <button onClick={() => setIsFormOpen(false)} className="rounded-xl border border-slate-300 px-16 py-10 text-slate-700">Cancel</button>
              <button onClick={handleSaveQuotation} className="min-h-[4rem] rounded-xl bg-app-primary px-16 py-10 font-semibold text-white hover:bg-blue-800">Save</button>
            </div>
          </div>
        </div>
      )}

      {isDetailOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-20">
          <div className="max-h-[90vh] w-full max-w-[100rem] overflow-auto rounded-3xl bg-white p-24 shadow-2xl">
            <div className="mb-20 flex items-center justify-between">
              <div>
                <p className="text-[2.6rem] font-bold">Detail Quotation</p>
                <p className="text-slate-500">{selected.number}</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="rounded-full bg-slate-100 p-10 text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-20 laptop:grid-cols-2 desktop:grid-cols-2">
              <div className="space-y-12">
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-16">
                  <h2 className="mb-12 text-[1.8rem] font-semibold text-slate-800">Informasi Quotation</h2>
                  <div className="flex flex-wrap items-center justify-between gap-12">
                    <div className="flex items-center gap-10">
                      <span className="text-slate-500">Status Transaksi</span>
                      <span className={clsx('rounded-full px-12 py-6 text-[1.3rem] font-medium', getStatusClass(selected.status))}>{statusLabels[selected.status]}</span>
                    </div>
                    {!isStatusEditorOpen ? (
                      <button type="button" onClick={() => setIsStatusEditorOpen(true)} className="rounded-lg border border-slate-300 bg-white px-12 py-8 text-[1.4rem] font-medium text-slate-700 hover:bg-slate-100">Ubah Status</button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-8">
                        <select
                          aria-label={`Pilih status transaksi ${selected.number}`}
                          value={selected.status}
                          disabled={updatingStatusId !== null}
                          onChange={(event) => void updateTransactionStatus(selected, event.target.value as QuotationStatus)}
                          className="rounded-lg border border-slate-300 bg-white px-10 py-8 text-[1.4rem] text-slate-700 disabled:opacity-60"
                        >
                          {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                        </select>
                        <button type="button" onClick={() => setIsStatusEditorOpen(false)} className="rounded-lg px-10 py-8 text-[1.4rem] text-slate-600 hover:bg-white">Batal</button>
                      </div>
                    )}
                  </div>
                  <div className="mt-16 grid gap-12 sm:grid-cols-2">
                    <div className="rounded-xl bg-white p-12"><p className="text-[1.3rem] text-slate-500">Jenis Penawaran</p><p className="mt-4 font-medium text-slate-800">{selected.type}</p></div>
                    <div className="rounded-xl bg-white p-12"><p className="text-[1.3rem] text-slate-500">Tanggal Quotation</p><p className="mt-4 font-medium text-slate-800">{formatDate(selected.date)}</p></div>
                    <div className="rounded-xl bg-white p-12"><p className="text-[1.3rem] text-slate-500">Berlaku Sampai</p><p className="mt-4 font-medium text-slate-800">{formatDate(selected.validUntil)}</p></div>
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-200 p-16">
                  <h2 className="mb-12 text-[1.8rem] font-semibold text-slate-800">Penerima / Customer</h2>
                  <div className="space-y-8 text-[1.5rem] text-slate-600">
                    <p className="font-semibold text-slate-800">{selected.recipient || 'Nama belum diisi'}</p>
                    <p>{[selected.address, selected.city].filter(Boolean).join(', ') || 'Alamat belum diisi'}</p>
                    <p>{selected.email || 'Email belum diisi'}</p>
                    <p>{selected.phone || 'Telepon belum diisi'}</p>
                  </div>
                </section>
              </div>
              <div className="space-y-12">
                <section className="rounded-2xl border border-slate-200 p-16">
                <h2 className="mb-12 text-[1.8rem] font-semibold text-slate-800">Tindak Lanjut</h2>
                <div className="space-y-8 text-[1.6rem] text-slate-600">
                  <p><span className="text-slate-500">Jadwal</span><br />{selected.followUpDate ? formatDate(selected.followUpDate) : 'Belum dijadwalkan'}</p>
                  <p><span className="text-slate-500">Status tindak lanjut</span><br />{selected.followUpStatus}</p>
                  <p><span className="text-slate-500">Catatan</span><br />{selected.followUpNotes || 'Belum ada catatan'}</p>
                </div>
                </section>
                <section className="rounded-2xl border border-slate-200 p-16">
                  <h2 className="mb-8 text-[1.8rem] font-semibold text-slate-800">Deskripsi dan Catatan</h2>
                  <p className="text-slate-700">{selected.title || selected.introduction || 'Belum ada deskripsi penawaran.'}</p>
                  <p className="mt-12 border-t border-slate-100 pt-12 text-[1.5rem] text-slate-600"><span className="font-medium text-slate-700">Catatan internal:</span> {selected.notes || 'Tidak ada catatan internal.'}</p>
                </section>
              </div>
            </div>

            <div className="mt-24">
              <p className="mb-8 text-[1.8rem] font-semibold">Item</p>
              {selected.items.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-12">Barang / Jasa</th>
                        <th className="p-12">Jumlah</th>
                        <th className="p-12">Satuan</th>
                        <th className="p-12">Harga Satuan</th>
                        <th className="p-12">Total Item</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item) => (
                        <tr key={item.id} className="border-t border-slate-200">
                          <td className="p-12">{item.description}</td>
                          <td className="p-12">{item.quantity}</td>
                          <td className="p-12">{item.unit}</td>
                          <td className="p-12">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-12">{formatCurrency(calculateLineTotal(item))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500">Belum ada item quotation.</p>
              )}
              {selected.items.length > 0 && (
                <div className="mt-12 flex justify-end">
                  <div className="min-w-[26rem] rounded-xl bg-slate-50 px-16 py-12 text-right">
                    <p className="text-[1.4rem] text-slate-500">Total Penawaran</p>
                    <p className="mt-4 text-[2rem] font-bold text-slate-800">{formatCurrency(getSummaryTotals(selected.items))}</p>
                  </div>
                </div>
              )}
            </div>

            <section className="mt-24 rounded-2xl border border-slate-200 p-16" aria-labelledby="quotation-attachments-title">
              <div className="mb-12 flex flex-wrap items-center justify-between gap-12">
                <div>
                  <h2 id="quotation-attachments-title" className="text-[1.8rem] font-semibold">Lampiran</h2>
                  <p className="mt-4 text-[1.4rem] text-slate-500">PDF, DOCX, XLSX, PNG, JPG, atau WEBP · Maks. 10 MB</p>
                </div>
                <label className="inline-flex min-h-[4rem] cursor-pointer items-center gap-8 rounded-xl border border-slate-300 px-12 py-8 text-[1.5rem] font-medium text-slate-700 hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  <Paperclip aria-hidden="true" size={16} />
                  {isAttachmentUploading ? 'Mengunggah...' : 'Tambah Lampiran'}
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
                    disabled={isAttachmentUploading}
                    onChange={(event) => {
                      void uploadAttachment(event.currentTarget.files?.[0] ?? null)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              </div>
              {selected.attachments?.length ? (
                <ul className="divide-y divide-slate-100">
                  {selected.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex min-w-0 items-center gap-12 py-10">
                      <Paperclip aria-hidden="true" className="shrink-0 text-slate-400" size={16} />
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 break-words text-[1.5rem] font-medium text-app-info hover:underline"
                      >
                        {attachment.name}
                      </a>
                      <span className="shrink-0 text-[1.3rem] text-slate-500">{(attachment.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <button
                        type="button"
                        title={`Hapus lampiran ${attachment.name}`}
                        aria-label={`Hapus lampiran ${attachment.name}`}
                        onClick={() => void deleteAttachment(attachment.id)}
                        className="inline-flex h-[3.6rem] w-[3.6rem] shrink-0 items-center justify-center rounded-lg bg-rose-50 text-app-danger hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-danger"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-slate-50 px-12 py-16 text-[1.5rem] text-slate-500">Belum ada lampiran.</p>
              )}
            </section>

            <div className="mt-24 flex justify-end gap-12">
              <button onClick={() => { setIsDetailOpen(false); setIsStatusEditorOpen(false) }} className="rounded-xl border border-slate-300 px-16 py-10 text-slate-700">Tutup</button>
              <button onClick={() => navigate('/surat/surat-penawaran', { state: { quotation: selected } })} className="min-h-[4rem] rounded-xl bg-app-primary px-16 py-10 font-semibold text-white hover:bg-blue-800">Generate Surat Penawaran</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-20 shadow-sm">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-[1.6rem]">{title}</span>
        <CalendarDays size={16} className="text-slate-400" />
      </div>
      <p className="mt-12 text-[3rem] font-bold text-slate-800">{value}</p>
    </div>
  )
}
