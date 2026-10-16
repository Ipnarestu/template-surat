import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Eye, FilePlus2, Plus, Search, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { closeNotification, showConfirm, showError, showLoading, showSuccess, showTextInput, showWarning } from '@/utils/notifications'
import { billingRequest, dateInputValue, formatIdDate, formatIdr } from '@/utils/billingApi'

type InvoiceItem = { id?: string; sourceItemId?: string | null; description: string; quantity: string | number; unit: string; unitPrice: string | number; discount: string | number; taxRate: string | number; subtotal?: string; taxAmount?: string; total?: string }
type SourceQuote = { id: string; number: string; recipient: string; items: Array<{ id: string; description: string; quantity: number; unit: string; unitPrice: number; discount?: number; taxRate?: number }> }
type POOption = { id: string; poNumber: string; recipient: string; status: string; quotationId: string | null; quotation?: { id: string; number: string; recipient: string } | null }
type Invoice = {
  id: string; number: string; customerName: string; issueDate: string | null; dueDate: string; status: string; subtotal: string; taxAmount: string; total: string; paidAmount: string; balance: string; overpayment: string; notes: string | null; purchaseOrderId: string | null; quotationId: string | null
  purchaseOrder?: { id: string; poNumber: string } | null; quotation?: { id: string; number: string } | null; items: InvoiceItem[]; statusHistory: Array<{ fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }>
}
type InvoiceForm = { number: string; customerName: string; issueDate: string; dueDate: string; purchaseOrderId: string; quotationId: string; notes: string; items: InvoiceItem[] }

const today = new Date().toISOString().slice(0, 10)
const emptyItem = (): InvoiceItem => ({ description: '', quantity: 1, unit: 'pcs', unitPrice: 0, discount: 0, taxRate: 0 })
const statusLabels: Record<string, string> = { DRAFT: 'Draft', ISSUED: 'Issued', PARTIALLY_PAID: 'Partially Paid', PAID: 'Paid', OVERDUE: 'Overdue', CANCELLED: 'Cancelled', REVIEW_REQUIRED: 'Perlu Ditinjau' }
const statusClass: Record<string, string> = { DRAFT: 'bg-slate-100 text-slate-700', ISSUED: 'bg-blue-100 text-blue-700', PARTIALLY_PAID: 'bg-amber-100 text-amber-800', PAID: 'bg-emerald-100 text-emerald-700', OVERDUE: 'bg-rose-100 text-rose-700', CANCELLED: 'bg-slate-200 text-slate-600', REVIEW_REQUIRED: 'bg-orange-100 text-orange-800' }

function blankForm(nextNumber: string): InvoiceForm {
  const due = new Date()
  due.setDate(due.getDate() + 30)
  return { number: nextNumber, customerName: '', issueDate: today, dueDate: due.toISOString().slice(0, 10), purchaseOrderId: '', quotationId: '', notes: '', items: [emptyItem()] }
}

function suggestedNumber(rows: Invoice[]) {
  const year = new Date().getFullYear()
  const count = rows.filter((invoice) => invoice.number.startsWith(`INV-${year}-`)).length + 1
  return `INV-${year}-${String(count).padStart(3, '0')}`
}

function estimateTotal(items: InvoiceItem[]) {
  return items.reduce((sum, item) => {
    const subtotal = Math.max(0, Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discount || 0))
    return sum + subtotal + subtotal * Number(item.taxRate || 0) / 100
  }, 0)
}

export default function InvoicePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [rows, setRows] = useState<Invoice[]>([])
  const [quotes, setQuotes] = useState<SourceQuote[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<POOption[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [selected, setSelected] = useState<Invoice | null>(null)
  const [form, setForm] = useState<InvoiceForm>(blankForm(''))

  const loadRows = useCallback(async () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (statusFilter) params.set('status', statusFilter)
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    setRows(await billingRequest<Invoice[]>(`/invoices?${params.toString()}`))
  }, [search, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    let active = true
    Promise.all([
      billingRequest<Invoice[]>('/invoices'),
      billingRequest<SourceQuote[]>('/quotations'),
      billingRequest<POOption[]>('/purchase-orders'),
    ]).then(([invoices, quotationRows, poRows]) => {
      if (!active) return
      setRows(invoices)
      setQuotes(quotationRows)
      setPurchaseOrders(poRows)
    }).catch((error) => {
      if (active) void showError('Invoice belum dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi backend.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (loading) return
    void loadRows().catch((error) => showError('Pencarian invoice gagal', error instanceof Error ? error.message : 'Silakan coba kembali.'))
  }, [loadRows, loading])

  const startNew = () => {
    const next = blankForm(suggestedNumber(rows))
    const requestedPO = (location.state as { purchaseOrderId?: string } | null)?.purchaseOrderId
    if (requestedPO) {
      const po = purchaseOrders.find((item) => item.id === requestedPO)
      if (po) {
        next.purchaseOrderId = po.id
        next.quotationId = po.quotationId || ''
        next.customerName = po.recipient
        const quote = quotes.find((item) => item.id === po.quotationId)
        if (quote) next.items = quote.items.map((item) => ({ sourceItemId: item.id, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, discount: item.discount || 0, taxRate: item.taxRate || 0 }))
      }
    }
    setSelected(null); setEditing(null); setForm(next); setIsFormOpen(true)
  }

  const editInvoice = (invoice: Invoice) => {
    setSelected(null); setEditing(invoice)
    setForm({ number: invoice.number, customerName: invoice.customerName, issueDate: dateInputValue(invoice.issueDate), dueDate: dateInputValue(invoice.dueDate), purchaseOrderId: invoice.purchaseOrderId || '', quotationId: invoice.quotationId || '', notes: invoice.notes || '', items: invoice.items.map((item) => ({ ...item, quantity: String(item.quantity), unitPrice: String(item.unitPrice), discount: String(item.discount), taxRate: String(item.taxRate) })) })
    setIsFormOpen(true)
  }

  const selectPO = (id: string) => {
    const po = purchaseOrders.find((item) => item.id === id)
    const quote = quotes.find((item) => item.id === (po?.quotationId || ''))
    setForm((current) => ({
      ...current,
      purchaseOrderId: id,
      quotationId: po?.quotationId || '',
      customerName: po?.recipient || current.customerName,
      items: quote?.items.map((item) => ({ sourceItemId: item.id, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, discount: item.discount || 0, taxRate: item.taxRate || 0 })) || current.items,
    }))
  }

  const selectQuote = (id: string) => {
    const quote = quotes.find((item) => item.id === id)
    setForm((current) => ({
      ...current,
      quotationId: id,
      purchaseOrderId: '',
      customerName: quote?.recipient || current.customerName,
      items: quote?.items.map((item) => ({ sourceItemId: item.id, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: item.unitPrice, discount: item.discount || 0, taxRate: item.taxRate || 0 })) || current.items,
    }))
  }

  const saveInvoice = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.number.trim() || !form.customerName.trim() || !form.dueDate || !form.items.length) {
      await showWarning('Data belum lengkap', 'Nomor, pelanggan, tanggal jatuh tempo, dan minimal satu item wajib diisi.')
      return
    }
    const body = { ...form }
    showLoading(editing ? 'Menyimpan draft invoice...' : 'Membuat draft invoice...')
    try {
      const saved = await billingRequest<Invoice>(editing ? `/invoices/${editing.id}` : '/invoices', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      closeNotification(); setIsFormOpen(false); setEditing(null); setSelected(saved)
      await loadRows()
      await showSuccess(editing ? 'Draft invoice diperbarui' : 'Draft invoice berhasil dibuat')
    } catch (error) {
      closeNotification()
      await showError('Invoice belum disimpan', error instanceof Error ? error.message : 'Periksa koneksi backend.')
    }
  }

  const issueInvoice = async (invoice: Invoice) => {
    if (!(await showConfirm('Terbitkan invoice?', `Invoice ${invoice.number} akan dikunci sebagai dokumen terbit.`, 'Ya, terbitkan'))) return
    showLoading('Menerbitkan invoice...')
    try {
      const updated = await billingRequest<Invoice>(`/invoices/${invoice.id}/issue`, { method: 'PATCH', body: '{}' })
      closeNotification(); setSelected(updated); await loadRows(); await showSuccess('Invoice berhasil diterbitkan')
    } catch (error) { closeNotification(); await showError('Invoice belum diterbitkan', error instanceof Error ? error.message : 'Periksa koneksi backend.') }
  }

  const cancelInvoice = async (invoice: Invoice) => {
    const reason = await showTextInput('Batalkan invoice', 'Alasan pembatalan')
    if (!reason) return
    if (!(await showConfirm('Konfirmasi pembatalan invoice?', 'Invoice hanya dapat dibatalkan setelah semua pembayarannya dibatalkan.', 'Ya, batalkan'))) return
    showLoading('Membatalkan invoice...')
    try {
      const updated = await billingRequest<Invoice>(`/invoices/${invoice.id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) })
      closeNotification(); setSelected(updated); await loadRows(); await showSuccess('Invoice dibatalkan')
    } catch (error) { closeNotification(); await showError('Invoice belum dibatalkan', error instanceof Error ? error.message : 'Periksa pembayaran terkait.') }
  }

  const rowsCount = useMemo(() => rows.length, [rows.length])

  return (
    <div className="flex min-w-0 flex-col gap-20 py-8">
      <header className="flex flex-wrap items-start justify-between gap-12">
        <div><h1 className="text-[3rem] font-bold text-slate-800">Invoice</h1><p className="mt-4 text-[1.5rem] text-slate-500">Kelola tagihan dari PO, Quotation, atau transaksi langsung.</p></div>
        <div className="flex gap-8"><button type="button" onClick={() => navigate('/po')} className="inline-flex min-h-[4.2rem] items-center gap-8 rounded-xl border border-slate-300 px-12 py-8 text-[1.5rem] font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} />PO</button><button type="button" onClick={startNew} className="inline-flex min-h-[4.2rem] items-center gap-8 rounded-xl bg-app-primary px-14 py-8 text-[1.5rem] font-semibold text-white hover:bg-blue-800"><Plus size={17} />Buat Invoice</button></div>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-16 shadow-sm">
        <div className="mb-14 flex flex-wrap items-center gap-10">
          <label className="relative w-full max-w-[40rem]"><Search aria-hidden="true" className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor invoice, pelanggan, PO, atau quotation" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-10 pl-40 pr-12 text-[1.5rem]" /></label>
          <select aria-label="Filter status invoice" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-12 py-10 text-[1.4rem]"><option value="">Semua status</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
          <label className="text-[1.3rem] text-slate-500">Dari <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-300 px-8 py-7 text-slate-700" /></label><label className="text-[1.3rem] text-slate-500">Sampai <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-300 px-8 py-7 text-slate-700" /></label>
          <span className="ml-auto text-[1.4rem] text-slate-500">{rowsCount} invoice</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[112rem] text-left text-[1.35rem]"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-12">Nomor Invoice</th><th className="p-12">Pelanggan</th><th className="p-12">Tanggal</th><th className="p-12">Jatuh Tempo</th><th className="p-12">PO / Quotation</th><th className="p-12 text-right">Total</th><th className="p-12 text-right">Dibayar</th><th className="p-12 text-right">Sisa</th><th className="p-12">Status</th><th className="p-12">Aksi</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={10} className="p-24 text-center text-slate-500">Memuat invoice…</td></tr> : rows.length === 0 ? <tr><td colSpan={10} className="p-24 text-center text-slate-500">Belum ada invoice. Buat draft dari PO atau Quotation.</td></tr> : rows.map((invoice) => <tr key={invoice.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="p-12 font-semibold text-slate-800">{invoice.number}</td><td className="p-12">{invoice.customerName}</td><td className="p-12">{formatIdDate(invoice.issueDate)}</td><td className="p-12">{formatIdDate(invoice.dueDate)}</td><td className="p-12">{invoice.purchaseOrder?.poNumber || invoice.quotation?.number || '—'}</td><td className="p-12 text-right">{formatIdr(invoice.total)}</td><td className="p-12 text-right">{formatIdr(invoice.paidAmount)}</td><td className="p-12 text-right">{formatIdr(invoice.balance)}</td><td className="p-12"><span className={clsx('whitespace-nowrap rounded-full px-10 py-5 text-[1.2rem] font-medium', statusClass[invoice.status] || statusClass.DRAFT)}>{statusLabels[invoice.status] || invoice.status}</span></td><td className="p-12"><button type="button" onClick={() => setSelected(invoice)} className="inline-flex items-center gap-6 text-blue-700 hover:text-blue-900"><Eye size={16} />Detail</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {isFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-16" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}><form onSubmit={saveInvoice} className="max-h-[92vh] w-full max-w-[110rem] overflow-auto rounded-2xl bg-white p-20 shadow-2xl">
        <div className="mb-16 flex items-start justify-between gap-12"><div><h2 className="text-[2.4rem] font-bold text-slate-800">{editing ? 'Edit Draft Invoice' : 'Buat Invoice'}</h2><p className="mt-4 text-slate-500">Data item disimpan sebagai snapshot dan tidak mengikuti perubahan Quotation.</p></div><button type="button" onClick={() => { setIsFormOpen(false); setEditing(null) }} aria-label="Tutup form invoice" className="rounded-full bg-slate-100 p-8 text-slate-600"><X size={18} /></button></div>
        <div className="grid gap-12 md:grid-cols-2">
          <Field label="Nomor Invoice"><input required maxLength={100} value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} className="control" /></Field>
          <Field label="Pelanggan"><input required maxLength={250} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} className="control" /></Field>
          <Field label="PO Asal (opsional)"><select value={form.purchaseOrderId} onChange={(event) => selectPO(event.target.value)} className="control"><option value="">Tidak terkait PO</option>{purchaseOrders.filter((po) => po.status !== 'CANCELLED').map((po) => <option key={po.id} value={po.id}>{po.poNumber} — {po.recipient}</option>)}</select></Field>
          <Field label="Quotation Asal (opsional)"><select value={form.quotationId} onChange={(event) => selectQuote(event.target.value)} className="control"><option value="">Tidak terkait Quotation</option>{quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} — {quote.recipient}</option>)}</select></Field>
          <Field label="Tanggal Invoice (draft)"><input type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} className="control" /></Field>
          <Field label="Tanggal Jatuh Tempo"><input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="control" /></Field>
          <Field label="Catatan"><textarea rows={2} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="control" /></Field>
        </div>
        <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-14"><div className="mb-10 flex flex-wrap items-center justify-between gap-8"><div><h3 className="text-[1.8rem] font-semibold">Rincian Invoice</h3><p className="text-[1.3rem] text-slate-500">Periksa harga dan pajak sebelum menyimpan draft.</p></div><button type="button" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })} className="inline-flex items-center gap-6 rounded-lg bg-app-primary px-10 py-8 text-[1.3rem] font-semibold text-white"><Plus size={15} />Tambah Item</button></div>
          <div className="space-y-8">{form.items.map((item, index) => <div key={item.id || index} className="grid min-w-0 gap-8 rounded-xl border border-slate-200 bg-white p-10 sm:grid-cols-2 lg:grid-cols-7">
            <label className="min-w-0 lg:col-span-2"><span className="mb-4 block text-[1.2rem] text-slate-600">Barang / Jasa</span><input required value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} className="control" /></label>
            <label><span className="mb-4 block text-[1.2rem] text-slate-600">Jumlah</span><input required type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} className="control" /></label>
            <label><span className="mb-4 block text-[1.2rem] text-slate-600">Satuan</span><input required value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} className="control" /></label>
            <label><span className="mb-4 block text-[1.2rem] text-slate-600">Harga Satuan</span><input required type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} className="control" /></label>
            <label><span className="mb-4 block text-[1.2rem] text-slate-600">Diskon</span><input type="number" min="0" step="0.01" value={item.discount} onChange={(event) => updateItem(index, 'discount', event.target.value)} className="control" /></label>
            <div className="flex items-end gap-6"><label className="min-w-0 flex-1"><span className="mb-4 block text-[1.2rem] text-slate-600">Pajak (%)</span><input type="number" min="0" max="999.99" step="0.01" value={item.taxRate} onChange={(event) => updateItem(index, 'taxRate', event.target.value)} className="control" /></label><button type="button" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Hapus item ${index + 1}`} className="mb-2 rounded-lg p-8 text-rose-600 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={15} /></button></div>
          </div>)}</div>
          <div className="mt-12 flex justify-end"><p className="rounded-xl bg-white px-14 py-10 text-right text-[1.3rem] text-slate-500">Perkiraan total <strong className="ml-8 block text-[1.8rem] text-slate-800">{formatIdr(estimateTotal(form.items))}</strong></p></div>
        </section>
        <div className="mt-16 flex justify-end gap-8"><button type="button" onClick={() => { setIsFormOpen(false); setEditing(null) }} className="rounded-xl border border-slate-300 px-14 py-8 text-slate-700">Batal</button><button type="submit" className="inline-flex items-center gap-6 rounded-xl bg-app-primary px-16 py-8 font-semibold text-white hover:bg-blue-800"><FilePlus2 size={16} />Simpan Draft</button></div>
      </form></div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-16" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div className="max-h-[90vh] w-full max-w-[96rem] overflow-auto rounded-2xl bg-white p-20 shadow-2xl">
        <div className="mb-16 flex items-start justify-between gap-12"><div><h2 className="text-[2.4rem] font-bold">Detail Invoice</h2><p className="mt-4 text-slate-500">{selected.number} · {selected.customerName}</p></div><div className="flex items-center gap-8"><span className={clsx('rounded-full px-12 py-6 text-[1.3rem] font-medium', statusClass[selected.status] || statusClass.DRAFT)}>{statusLabels[selected.status] || selected.status}</span><button type="button" onClick={() => setSelected(null)} aria-label="Tutup detail invoice" className="rounded-full bg-slate-100 p-8 text-slate-600"><X size={18} /></button></div></div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4"><Info label="Tanggal Invoice" value={formatIdDate(selected.issueDate)} /><Info label="Jatuh Tempo" value={formatIdDate(selected.dueDate)} /><Info label="PO / Quotation" value={selected.purchaseOrder?.poNumber || selected.quotation?.number || '—'} /><Info label="Total" value={formatIdr(selected.total)} /><Info label="Dibayar Terverifikasi" value={formatIdr(selected.paidAmount)} /><Info label="Sisa Tagihan" value={formatIdr(selected.balance)} /><Info label="Subtotal" value={formatIdr(selected.subtotal)} /><Info label="Pajak" value={formatIdr(selected.taxAmount)} /></div>
        {selected.notes && <p className="mt-12 rounded-xl bg-slate-50 p-12 text-slate-600">{selected.notes}</p>}
        <div className="mt-16 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[70rem] text-left text-[1.35rem]"><thead className="bg-slate-50"><tr><th className="p-10">Barang / Jasa</th><th className="p-10">Jumlah</th><th className="p-10">Satuan</th><th className="p-10 text-right">Harga Satuan</th><th className="p-10 text-right">Diskon</th><th className="p-10 text-right">Pajak</th><th className="p-10 text-right">Total</th></tr></thead><tbody>{selected.items.map((item, index) => <tr key={item.id || index} className="border-t border-slate-100"><td className="p-10">{item.description}</td><td className="p-10">{item.quantity}</td><td className="p-10">{item.unit}</td><td className="p-10 text-right">{formatIdr(item.unitPrice)}</td><td className="p-10 text-right">{formatIdr(item.discount)}</td><td className="p-10 text-right">{item.taxRate}%</td><td className="p-10 text-right font-semibold">{formatIdr(item.total)}</td></tr>)}</tbody></table></div>
        {selected.statusHistory?.length > 0 && <section className="mt-16 rounded-xl border border-slate-200 p-14"><h3 className="mb-8 font-semibold">Riwayat Status</h3><ul className="space-y-6 text-[1.3rem] text-slate-600">{selected.statusHistory.map((entry, index) => <li key={`${entry.createdAt}-${index}`}>{formatIdDate(entry.createdAt)} · {statusLabels[entry.fromStatus || ''] || '—'} → {statusLabels[entry.toStatus] || entry.toStatus}{entry.note ? ` — ${entry.note}` : ''}</li>)}</ul></section>}
        <div className="mt-16 flex flex-wrap justify-end gap-8">{selected.status === 'DRAFT' && <><button type="button" onClick={() => editInvoice(selected)} className="rounded-xl border border-slate-300 px-12 py-8 font-medium text-slate-700">Edit Draft</button><button type="button" onClick={() => void issueInvoice(selected)} className="rounded-xl bg-app-primary px-14 py-8 font-semibold text-white">Terbitkan</button></>}{selected.status !== 'DRAFT' && selected.status !== 'CANCELLED' && <button type="button" onClick={() => navigate('/bukti-bayar', { state: { invoiceId: selected.id } })} className="rounded-xl bg-app-primary px-14 py-8 font-semibold text-white">Catat Pembayaran</button>}{selected.status !== 'CANCELLED' && <button type="button" onClick={() => void cancelInvoice(selected)} className="rounded-xl border border-rose-200 px-12 py-8 font-medium text-rose-700 hover:bg-rose-50">Batalkan Invoice</button>}<button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-14 py-8 text-slate-700">Tutup</button></div>
      </div></div>}
    </div>
  )

  function updateItem(index: number, key: keyof InvoiceItem, value: string) {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-5 block text-[1.4rem] font-medium text-slate-700">{label}</span>{children}</label>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-12"><p className="text-[1.3rem] text-slate-500">{label}</p><p className="mt-4 break-words font-medium text-slate-800">{value}</p></div>
}
