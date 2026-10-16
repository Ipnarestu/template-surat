import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Eye, FileText, Paperclip, Plus, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { closeNotification, showConfirm, showError, showLoading, showSuccess, showTextInput, showWarning } from '@/utils/notifications'
import { billingRequest, dateInputValue, formatIdDate, formatIdr } from '@/utils/billingApi'

type POAttachment = { id: string; name: string; url: string; mimeType: string; size: number; uploadedAt: string }
type QuotationOption = { id: string; number: string; recipient: string; items?: Array<{ id: string; description: string; quantity: number; unit: string; unitPrice: number }> }
type PurchaseOrder = {
  id: string; poNumber: string; date: string; receivedAt: string; recipient: string; amount: string | null
  status: 'RECEIVED' | 'CANCELLED'; notes: string | null; source: string; quotationId: string | null
  quotation?: { id: string; number: string; recipient: string } | null; attachments: POAttachment[]
  invoices?: Array<{ id: string; number: string; status: string; total: string }>
}
type POForm = { poNumber: string; date: string; receivedAt: string; recipient: string; quotationId: string; amount: string; notes: string; file: File | null }

const today = new Date().toISOString().slice(0, 10)
const emptyForm = (): POForm => ({ poNumber: '', date: today, receivedAt: today, recipient: '', quotationId: '', amount: '', notes: '', file: null })

function poStatus(status: string) {
  return status === 'CANCELLED'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-emerald-100 text-emerald-700'
}

export default function PurchaseOrderPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<PurchaseOrder[]>([])
  const [quotations, setQuotations] = useState<QuotationOption[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<POForm>(emptyForm)
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [selected, setSelected] = useState<PurchaseOrder | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const loadRows = useCallback(async () => {
    const query = new URLSearchParams()
    if (search.trim()) query.set('search', search.trim())
    if (status) query.set('status', status)
    const data = await billingRequest<PurchaseOrder[]>(`/purchase-orders?${query.toString()}`)
    setRows(data)
  }, [search, status])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const legacyKey = 'luma-po-legacy-import-checked'
        if (!localStorage.getItem(legacyKey)) {
          const legacy = JSON.parse(localStorage.getItem('luma-po-quick-in') || '[]') as unknown
          if (Array.isArray(legacy) && legacy.length > 0) {
            const imported = await billingRequest<{ imported: number; results: Array<{ result: string; reason?: string }> }>('/purchase-orders/import-legacy', {
              method: 'POST', body: JSON.stringify({ records: legacy }),
            })
            localStorage.setItem(legacyKey, 'true')
            if (imported.imported > 0) await showSuccess('Quick In lama berhasil diimpor', `${imported.imported} PO disimpan ke database. Data lokal tetap dipertahankan.`)
            const skipped = imported.results.filter((record) => ['duplicate-number', 'invalid'].includes(record.result))
            if (skipped.length) await showWarning('Sebagian Quick In perlu diperiksa', `${skipped.length} catatan tidak diimpor karena duplikat atau datanya tidak lengkap. Data lokal tidak dihapus.`)
          } else {
            localStorage.setItem(legacyKey, 'true')
          }
        }
        const [purchaseOrders, quoteRows] = await Promise.all([
          billingRequest<PurchaseOrder[]>('/purchase-orders'),
          billingRequest<QuotationOption[]>('/quotations'),
        ])
        if (active) { setRows(purchaseOrders); setQuotations(quoteRows) }
      } catch (error) {
        if (active) await showError('Data PO belum dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi backend.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (loading) return
    void loadRows().catch((error) => showError('Pencarian PO gagal', error instanceof Error ? error.message : 'Silakan coba kembali.'))
  }, [loadRows, loading])

  const openCreate = () => { setSelected(null); setEditing(null); setForm(emptyForm()); setIsFormOpen(true) }
  const openEdit = (row: PurchaseOrder) => {
    setSelected(null)
    setEditing(row)
    setForm({ poNumber: row.poNumber, date: dateInputValue(row.date), receivedAt: dateInputValue(row.receivedAt), recipient: row.recipient, quotationId: row.quotationId || '', amount: row.amount || '', notes: row.notes || '', file: null })
    setIsFormOpen(true)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.poNumber.trim() || !form.recipient.trim()) {
      await showWarning('Data belum lengkap', 'Nomor PO dan nama customer wajib diisi.')
      return
    }
    showLoading(editing ? 'Menyimpan perubahan PO...' : 'Mencatat PO...')
    let saved: PurchaseOrder
    try {
      saved = await billingRequest<PurchaseOrder>(editing ? `/purchase-orders/${editing.id}` : '/purchase-orders', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({ poNumber: form.poNumber, date: form.date, receivedAt: form.receivedAt, recipient: form.recipient, quotationId: form.quotationId || null, amount: form.amount || null, notes: form.notes }),
      })
    } catch (error) {
      closeNotification()
      await showError('PO belum berhasil disimpan', error instanceof Error ? error.message : 'Periksa koneksi backend lalu coba kembali.')
      return
    }
    if (form.file) {
      try {
        const formData = new FormData()
        formData.append('file', form.file)
        await billingRequest(`/purchase-orders/${saved.id}/attachments`, { method: 'POST', body: formData })
      } catch (error) {
        closeNotification(); setEditing(null); setIsFormOpen(false); await loadRows()
        await showWarning('PO tersimpan, lampiran belum terunggah', error instanceof Error ? error.message : 'PO sudah tercatat. Unggah lampiran dari detail PO.')
        return
      }
    }
    closeNotification()
    setEditing(null)
    setIsFormOpen(false)
    await loadRows()
    await showSuccess(editing ? 'PO berhasil diperbarui' : 'PO berhasil dicatat')
  }

  const cancelPO = async (row: PurchaseOrder) => {
    const reason = await showTextInput('Batalkan Purchase Order', 'Alasan pembatalan')
    if (!reason) return
    if (!(await showConfirm('Konfirmasi pembatalan PO', `PO ${row.poNumber} akan ditandai dibatalkan.`, 'Ya, batalkan'))) return
    showLoading('Membatalkan PO...')
    try {
      await billingRequest(`/purchase-orders/${row.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) })
      closeNotification()
      setSelected(null)
      await loadRows()
      await showSuccess('Purchase Order dibatalkan')
    } catch (error) {
      closeNotification()
      await showError('PO belum dibatalkan', error instanceof Error ? error.message : 'Periksa koneksi backend.')
    }
  }

  const deleteAttachment = async (attachment: POAttachment) => {
    if (!selected || !(await showConfirm('Hapus lampiran PO?', attachment.name, 'Ya, hapus'))) return
    showLoading('Menghapus lampiran...')
    try {
      await billingRequest(`/purchase-orders/${selected.id}/attachments/${attachment.id}`, { method: 'DELETE' })
      closeNotification()
      const updated = await billingRequest<PurchaseOrder>(`/purchase-orders/${selected.id}`)
      setSelected(updated)
      await loadRows()
      await showSuccess('Lampiran berhasil dihapus')
    } catch (error) {
      closeNotification()
      await showError('Lampiran belum dihapus', error instanceof Error ? error.message : 'Periksa koneksi backend.')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-20 py-8">
      <header className="flex flex-wrap items-start justify-between gap-12">
        <div>
          <h1 className="text-[3rem] font-bold text-slate-800">Purchase Order</h1>
          <p className="mt-4 text-[1.5rem] text-slate-500">Catat PO masuk dan hubungkan dengan Quotation jika tersedia.</p>
        </div>
        <div className="flex flex-wrap gap-8">
          <button type="button" onClick={() => navigate('/quotation')} className="inline-flex min-h-[4.2rem] items-center gap-8 rounded-xl border border-slate-300 bg-white px-12 py-8 text-[1.5rem] font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} />Quotation</button>
          <button type="button" onClick={openCreate} className="inline-flex min-h-[4.2rem] items-center gap-8 rounded-xl bg-app-primary px-14 py-8 text-[1.5rem] font-semibold text-white hover:bg-blue-800"><Plus size={17} />PO In / Quick In</button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-16 shadow-sm">
        <div className="mb-14 flex flex-wrap items-center justify-between gap-12">
          <label className="relative w-full max-w-[42rem]">
            <Search aria-hidden="true" className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor PO atau customer" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-10 pl-40 pr-12 text-[1.5rem]" />
          </label>
          <select aria-label="Filter status PO" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-12 py-10 text-[1.5rem]">
            <option value="">Semua status</option><option value="RECEIVED">Diterima</option><option value="CANCELLED">Dibatalkan</option>
          </select>
          <span className="text-[1.4rem] text-slate-500">{rows.length} PO</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[88rem] text-left text-[1.4rem]">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="p-12 font-semibold">Nomor PO</th><th className="p-12 font-semibold">Customer</th><th className="p-12 font-semibold">Tanggal Diterima</th><th className="p-12 font-semibold">Quotation Asal</th><th className="p-12 text-right font-semibold">Nilai PO</th><th className="p-12 font-semibold">Status</th><th className="p-12 font-semibold">Aksi</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-24 text-center text-slate-500">Memuat data PO…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="p-24 text-center text-slate-500">Belum ada PO yang tercatat.</td></tr> : rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="p-12 font-semibold text-slate-800">{row.poNumber}</td><td className="p-12">{row.recipient}</td><td className="p-12">{formatIdDate(row.receivedAt)}</td><td className="p-12">{row.quotation?.number || '—'}</td><td className="p-12 text-right">{row.amount ? formatIdr(row.amount) : '—'}</td><td className="p-12"><span className={clsx('rounded-full px-10 py-5 text-[1.2rem] font-medium', poStatus(row.status))}>{row.status === 'CANCELLED' ? 'Dibatalkan' : 'Diterima'}</span></td>
                  <td className="p-12"><div className="flex items-center gap-8"><button type="button" onClick={() => setSelected(row)} className="inline-flex items-center gap-6 text-blue-700 hover:text-blue-900"><Eye size={16} />Detail</button>{row.status !== 'CANCELLED' && <button type="button" onClick={() => openEdit(row)} className="text-blue-700 hover:text-blue-900">Edit</button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-20" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
        <div className="max-h-[90vh] w-full max-w-[72rem] overflow-auto rounded-2xl bg-white p-20 shadow-2xl">
          <div className="mb-16 flex items-start justify-between gap-12"><div><h2 className="text-[2.4rem] font-bold text-slate-800">Detail PO</h2><p className="mt-4 text-slate-500">{selected.poNumber}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup detail PO" className="rounded-full bg-slate-100 p-8 text-slate-600"><X size={18} /></button></div>
          <div className="grid gap-12 sm:grid-cols-2">
            <Info label="Customer" value={selected.recipient} /><Info label="Tanggal PO" value={formatIdDate(selected.date)} /><Info label="Tanggal diterima" value={formatIdDate(selected.receivedAt)} /><Info label="Quotation" value={selected.quotation?.number || 'Tidak terhubung'} /><Info label="Nilai PO" value={selected.amount ? formatIdr(selected.amount) : 'Belum dicatat'} /><Info label="Status" value={selected.status === 'CANCELLED' ? 'Dibatalkan' : 'Diterima'} />
          </div>
          {selected.notes && <p className="mt-12 rounded-xl bg-slate-50 p-12 text-slate-600">{selected.notes}</p>}
          <section className="mt-16 rounded-xl border border-slate-200 p-14">
            <div className="mb-10 flex items-center justify-between gap-12"><h3 className="text-[1.8rem] font-semibold">Lampiran</h3>{selected.status !== 'CANCELLED' && <label className="cursor-pointer text-[1.4rem] font-medium text-blue-700 hover:text-blue-900"><Paperclip className="mr-5 inline" size={15} />Tambah file<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={async (event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return; const data = new FormData(); data.append('file', file); showLoading('Mengunggah lampiran...'); try { await billingRequest(`/purchase-orders/${selected.id}/attachments`, { method: 'POST', body: data }); closeNotification(); const fresh = await billingRequest<PurchaseOrder>(`/purchase-orders/${selected.id}`); setSelected(fresh); await loadRows(); await showSuccess('Lampiran PO berhasil diunggah') } catch (error) { closeNotification(); await showError('Lampiran belum diunggah', error instanceof Error ? error.message : 'Periksa file dan koneksi backend.') } }} /></label>}</div>
            {selected.attachments.length ? <ul className="divide-y divide-slate-100">{selected.attachments.map((file) => <li key={file.id} className="flex min-w-0 items-center gap-8 py-8"><Paperclip size={15} className="shrink-0 text-slate-400" /><a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-words text-blue-700 hover:underline">{file.name}</a><span className="text-[1.2rem] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" onClick={() => void deleteAttachment(file)} className="text-rose-600 hover:text-rose-800" aria-label={`Hapus ${file.name}`}>Hapus</button></li>)}</ul> : <p className="text-[1.4rem] text-slate-500">Belum ada lampiran.</p>}
          </section>
          <div className="mt-16 flex flex-wrap justify-end gap-8"><button type="button" onClick={() => navigate('/invoice', { state: { purchaseOrderId: selected.id } })} className="inline-flex items-center gap-6 rounded-xl border border-slate-300 px-12 py-8 text-[1.4rem] font-medium text-slate-700 hover:bg-slate-50"><FileText size={15} />Buat Invoice</button>{selected.status !== 'CANCELLED' && <button type="button" onClick={() => void cancelPO(selected)} className="rounded-xl border border-rose-200 px-12 py-8 text-[1.4rem] font-medium text-rose-700 hover:bg-rose-50">Batalkan PO</button>}<button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-app-primary px-14 py-8 text-[1.4rem] font-semibold text-white">Tutup</button></div>
        </div>
      </div>}

      {isFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-20" onMouseDown={(event) => { if (event.target === event.currentTarget) { setIsFormOpen(false); setEditing(null) } }}>
        <form onSubmit={handleSave} className="max-h-[90vh] w-full max-w-[72rem] overflow-auto rounded-2xl bg-white p-20 shadow-2xl">
          <div className="mb-16 flex items-start justify-between gap-12"><div><h2 className="text-[2.4rem] font-bold text-slate-800">{editing ? 'Edit Purchase Order' : 'PO In / Quick In'}</h2><p className="mt-4 text-slate-500">Catat PO ke database dan hubungkan dengan Quotation bila ada.</p></div><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false) }} aria-label="Tutup formulir PO" className="rounded-full bg-slate-100 p-8 text-slate-600"><X size={18} /></button></div>
          <div className="grid gap-12 sm:grid-cols-2">
            <Field label="Nomor PO"><input required maxLength={100} value={form.poNumber} onChange={(event) => setForm({ ...form, poNumber: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" /></Field>
            <Field label="Penerima / Customer"><input required maxLength={250} value={form.recipient} onChange={(event) => setForm({ ...form, recipient: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" /></Field>
            <Field label="Tanggal PO"><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" /></Field>
            <Field label="Tanggal diterima"><input required type="date" value={form.receivedAt} onChange={(event) => setForm({ ...form, receivedAt: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" /></Field>
            <Field label="Quotation asal"><select value={form.quotationId} onChange={(event) => { const quotationId = event.target.value; const quote = quotations.find((item) => item.id === quotationId); setForm({ ...form, quotationId, recipient: quote?.recipient || form.recipient }) }} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10"><option value="">Tidak terkait Quotation</option>{quotations.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} — {quote.recipient}</option>)}</select></Field>
            <Field label="Nilai PO (opsional)"><input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" /></Field>
            <Field label="Keterangan"><textarea maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="w-full rounded-xl border border-slate-300 bg-white px-12 py-10" /></Field>
            <Field label="Lampiran PO (PDF/JPG/PNG/WEBP)"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} className="block w-full text-[1.4rem]" /></Field>
          </div>
          <div className="mt-18 flex justify-end gap-8"><button type="button" onClick={() => { setEditing(null); setIsFormOpen(false) }} className="rounded-xl border border-slate-300 px-14 py-8 text-slate-700">Batal</button><button type="submit" className="rounded-xl bg-app-primary px-16 py-8 font-semibold text-white hover:bg-blue-800">Simpan PO</button></div>
        </form>
      </div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-5 block text-[1.4rem] font-medium text-slate-700">{label}</span>{children}</label>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-12"><p className="text-[1.3rem] text-slate-500">{label}</p><p className="mt-4 break-words font-medium text-slate-800">{value}</p></div>
}
