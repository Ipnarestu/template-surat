import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Eye, Paperclip, Plus, Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { billingRequest, formatIdDate, formatIdr } from '@/utils/billingApi'
import { closeNotification, showConfirm, showError, showLoading, showPasswordInput, showSuccess, showTextInput, showWarning } from '@/utils/notifications'

type InvoiceOption = { id: string; number: string; customerName: string; status: string; total: string; paidAmount: string; balance: string }
type Attachment = { id: string; name: string; url: string; mimeType: string; size: number; uploadedAt: string }
type PaymentHistory = { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }
type Payment = {
  id: string; invoiceId: string; amount: string; paymentDate: string; method: string; reference: string | null; notes: string | null; status: 'PENDING' | 'VERIFIED' | 'CANCELLED' | 'REVIEW_REQUIRED'; verifiedAt: string | null; cancelledAt: string | null; cancellationReason: string | null
  invoice: { id: string; number: string; customerName: string; total: string; status: string }; attachments: Attachment[]; history?: PaymentHistory[]
}
type PaymentForm = { invoiceId: string; amount: string; paymentDate: string; method: string; reference: string; notes: string; file: File | null }

const emptyForm = (): PaymentForm => ({ invoiceId: '', amount: '', paymentDate: new Date().toISOString().slice(0, 10), method: 'Transfer Bank', reference: '', notes: '', file: null })
const statusText: Record<string, string> = { PENDING: 'Menunggu Verifikasi', VERIFIED: 'Terverifikasi', CANCELLED: 'Dibatalkan', REVIEW_REQUIRED: 'Perlu Ditinjau' }
const statusColor: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-800', VERIFIED: 'bg-emerald-100 text-emerald-700', CANCELLED: 'bg-slate-200 text-slate-600', REVIEW_REQUIRED: 'bg-orange-100 text-orange-800' }

export default function PaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [rows, setRows] = useState<Payment[]>([])
  const [invoices, setInvoices] = useState<InvoiceOption[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [verificationConfigured, setVerificationConfigured] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selected, setSelected] = useState<Payment | null>(null)
  const [form, setForm] = useState<PaymentForm>(emptyForm)

  const loadRows = useCallback(async () => {
    const query = new URLSearchParams()
    if (search.trim()) query.set('search', search.trim())
    if (statusFilter) query.set('status', statusFilter)
    if (dateFrom) query.set('from', dateFrom)
    if (dateTo) query.set('to', dateTo)
    setRows(await billingRequest<Payment[]>(`/payments?${query.toString()}`))
  }, [search, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    let active = true
    Promise.all([
      billingRequest<Payment[]>('/payments'),
      billingRequest<InvoiceOption[]>('/invoices'),
      billingRequest<{ paymentVerificationConfigured: boolean }>('/health'),
    ]).then(([payments, invoicesList, health]) => {
      if (!active) return
      setRows(payments)
      setInvoices(invoicesList)
      setVerificationConfigured(health.paymentVerificationConfigured)
      const requestedInvoice = (location.state as { invoiceId?: string } | null)?.invoiceId
      if (requestedInvoice) {
        const invoice = invoicesList.find((item) => item.id === requestedInvoice)
        if (invoice) { setForm({ ...emptyForm(), invoiceId: invoice.id }); setIsFormOpen(true) }
      }
    }).catch((error) => {
      if (active) void showError('Pembayaran belum dapat dimuat', error instanceof Error ? error.message : 'Periksa koneksi backend.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [location.state])

  useEffect(() => {
    if (loading) return
    void loadRows().catch((error) => showError('Pencarian pembayaran gagal', error instanceof Error ? error.message : 'Silakan coba kembali.'))
  }, [loadRows, loading])

  const startCreate = () => {
    const invoiceId = (location.state as { invoiceId?: string } | null)?.invoiceId || ''
    setSelected(null); setForm({ ...emptyForm(), invoiceId }); setIsFormOpen(true)
  }

  const savePayment = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.invoiceId || !form.amount || Number(form.amount) <= 0 || !form.paymentDate || !form.method) {
      await showWarning('Data belum lengkap', 'Pilih invoice dan isi nominal, tanggal, serta metode pembayaran yang valid.')
      return
    }
    showLoading('Mencatat pembayaran...')
    let payment: Payment
    try {
      payment = await billingRequest<Payment>('/payments', { method: 'POST', body: JSON.stringify({ invoiceId: form.invoiceId, amount: form.amount, paymentDate: form.paymentDate, method: form.method, reference: form.reference || null, notes: form.notes || null }) })
    } catch (error) {
      closeNotification()
      await showError('Pembayaran belum tercatat', error instanceof Error ? error.message : 'Periksa koneksi backend.')
      return
    }
    if (form.file) {
      try {
        const data = new FormData(); data.append('file', form.file)
        await billingRequest(`/payments/${payment.id}/attachments`, { method: 'POST', body: data })
      } catch (error) {
        closeNotification(); setIsFormOpen(false); await loadRows()
        await showWarning('Pembayaran tercatat, bukti belum terunggah', error instanceof Error ? error.message : 'Pembayaran Pending sudah tersimpan. Unggah bukti dari detail pembayaran.')
        return
      }
    }
    closeNotification(); setIsFormOpen(false); setForm(emptyForm()); await loadRows(); await showSuccess('Pembayaran Pending berhasil dicatat', 'Saldo invoice belum berubah sampai pembayaran diverifikasi.')
  }

  const saveOverpaymentCase = async () => {
    if (!selectedInvoice || Number(form.amount) <= Number(selectedInvoice.balance)) return
    if (!verificationConfigured) { await showWarning('Pencatatan perlu verifikasi', 'Administrator perlu mengatur kode verifikasi di backend sebelum kasus kelebihan pembayaran dapat dicatat.'); return }
    const reason = await showTextInput('Catat kasus pembayaran berlebih', 'Alasan untuk peninjauan')
    if (!reason) return
    if (!(await showConfirm('Simpan sebagai kasus peninjauan?', 'Nominal tidak akan mengurangi saldo invoice sampai dikoreksi dan dicatat sebagai pembayaran normal.', 'Ya, catat kasus'))) return
    const token = await showPasswordInput('Kode verifikasi pembayaran', 'Masukkan kode administrator')
    if (!token) return
    showLoading('Mencatat kasus pembayaran...')
    let payment: Payment
    try {
      payment = await billingRequest<Payment>('/payments/overpayment-case', { method: 'POST', headers: { 'x-payment-verification-token': token }, body: JSON.stringify({ invoiceId: form.invoiceId, amount: form.amount, paymentDate: form.paymentDate, method: form.method, reference: form.reference || null, notes: form.notes || null, reason }) })
    } catch (error) { closeNotification(); await showError('Kasus belum tercatat', error instanceof Error ? error.message : 'Periksa kode dan koneksi backend.'); return }
    if (form.file) {
      try {
        const data = new FormData(); data.append('file', form.file)
        await billingRequest(`/payments/${payment.id}/attachments`, { method: 'POST', body: data })
      } catch (error) {
        closeNotification(); setIsFormOpen(false); await loadRows()
        await showWarning('Kasus tercatat, bukti belum terunggah', error instanceof Error ? error.message : 'Kasus sudah tersimpan. Unggah bukti dari detail pembayaran.')
        return
      }
    }
    closeNotification(); setIsFormOpen(false); setForm(emptyForm()); await loadRows(); await showSuccess('Kasus pembayaran dicatat', 'Kasus berstatus Perlu Ditinjau dan tidak mengurangi saldo invoice.')
  }

  const uploadAttachment = async (payment: Payment, file: File) => {
    const data = new FormData(); data.append('file', file)
    showLoading('Mengunggah bukti pembayaran...')
    try {
      await billingRequest(`/payments/${payment.id}/attachments`, { method: 'POST', body: data })
      closeNotification(); await refreshDetail(payment.id); await loadRows(); await showSuccess('Bukti pembayaran berhasil diunggah')
    } catch (error) { closeNotification(); await showError('Bukti belum terunggah', error instanceof Error ? error.message : 'Periksa format file dan koneksi backend.') }
  }

  const refreshDetail = async (id: string) => {
    const payment = await billingRequest<Payment>(`/payments/${id}`)
    setSelected(payment)
    const invoiceList = await billingRequest<InvoiceOption[]>('/invoices')
    setInvoices(invoiceList)
  }

  const verifyPayment = async (payment: Payment) => {
    if (!verificationConfigured) {
      await showWarning('Verifikasi belum dikonfigurasi', 'Administrator perlu mengatur PAYMENT_VERIFICATION_TOKEN pada backend terlebih dahulu.')
      return
    }
    if (!(await showConfirm('Verifikasi pembayaran?', `${payment.invoice.number} — ${formatIdr(payment.amount)} akan diperhitungkan sebagai pembayaran sah.`, 'Ya, verifikasi'))) return
    const token = await showPasswordInput('Kode verifikasi pembayaran', 'Masukkan kode verifikasi administrator')
    if (!token) return
    showLoading('Memverifikasi pembayaran...')
    try {
      await billingRequest(`/payments/${payment.id}/verify`, { method: 'PATCH', headers: { 'x-payment-verification-token': token }, body: '{}' })
      closeNotification(); await refreshDetail(payment.id); await loadRows(); await showSuccess('Pembayaran berhasil diverifikasi', 'Saldo dan status invoice sudah diperbarui.')
    } catch (error) { closeNotification(); await showError('Pembayaran belum diverifikasi', error instanceof Error ? error.message : 'Kode atau koneksi backend tidak valid.') }
  }

  const cancelPayment = async (payment: Payment) => {
    const reason = await showTextInput('Batalkan pembayaran', 'Alasan pembatalan')
    if (!reason) return
    if (!(await showConfirm('Konfirmasi pembatalan?', 'Pembatalan dicatat pada riwayat dan mengubah saldo invoice jika pembayaran sudah diverifikasi.', 'Ya, batalkan'))) return
    let token: string | null = null
    if (payment.status === 'VERIFIED' || payment.status === 'REVIEW_REQUIRED') {
      if (!verificationConfigured) { await showWarning('Verifikasi belum dikonfigurasi', 'Administrator perlu mengatur PAYMENT_VERIFICATION_TOKEN sebelum membatalkan pembayaran terverifikasi.'); return }
      token = await showPasswordInput('Kode verifikasi pembayaran', 'Masukkan kode administrator untuk membatalkan pembayaran terverifikasi')
      if (!token) return
    }
    showLoading('Membatalkan pembayaran...')
    try {
      await billingRequest(`/payments/${payment.id}/cancel`, { method: 'PATCH', headers: token ? { 'x-payment-verification-token': token } : {}, body: JSON.stringify({ reason }) })
      closeNotification(); await refreshDetail(payment.id); await loadRows(); await showSuccess('Pembayaran dibatalkan', 'Saldo invoice telah dihitung ulang.')
    } catch (error) { closeNotification(); await showError('Pembayaran belum dibatalkan', error instanceof Error ? error.message : 'Periksa koneksi backend.') }
  }

  const deleteAttachment = async (payment: Payment, file: Attachment) => {
    if (!(await showConfirm('Hapus bukti pembayaran?', file.name, 'Ya, hapus'))) return
    showLoading('Menghapus bukti...')
    try {
      await billingRequest(`/payments/${payment.id}/attachments/${file.id}`, { method: 'DELETE' })
      closeNotification(); await refreshDetail(payment.id); await loadRows(); await showSuccess('Bukti pembayaran dihapus')
    } catch (error) { closeNotification(); await showError('Bukti belum dihapus', error instanceof Error ? error.message : 'Lampiran terverifikasi dilindungi untuk menjaga riwayat.') }
  }

  const selectedInvoice = invoices.find((invoice) => invoice.id === form.invoiceId)

  return (
    <div className="flex min-w-0 flex-col gap-20 py-8">
      <header className="flex flex-wrap items-start justify-between gap-12"><div><h1 className="text-[3rem] font-bold text-slate-800">Bukti Bayar</h1><p className="mt-4 text-[1.5rem] text-slate-500">Catat pembayaran, unggah bukti, dan verifikasi terhadap invoice.</p></div><div className="flex gap-8"><button type="button" onClick={() => navigate('/invoice')} className="inline-flex min-h-[4.2rem] items-center gap-8 rounded-xl border border-slate-300 px-12 py-8 text-[1.5rem] font-medium text-slate-700 hover:bg-slate-50"><ArrowLeft size={16} />Invoice</button><button type="button" onClick={startCreate} className="inline-flex min-h-[4.2rem] items-center gap-8 rounded-xl bg-app-primary px-14 py-8 text-[1.5rem] font-semibold text-white hover:bg-blue-800"><Plus size={17} />Catat Pembayaran</button></div></header>
      {!verificationConfigured && <p className="rounded-xl border border-amber-200 bg-amber-50 px-12 py-10 text-[1.35rem] text-amber-800">Verifikasi pembayaran terkunci sampai administrator mengatur kode verifikasi pada backend.</p>}
      <section className="rounded-2xl border border-slate-200 bg-white p-16 shadow-sm">
        <div className="mb-14 flex flex-wrap items-center gap-10"><label className="relative w-full max-w-[40rem]"><Search aria-hidden="true" className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari referensi, invoice, atau pelanggan" className="w-full rounded-xl border border-slate-300 bg-slate-50 py-10 pl-40 pr-12 text-[1.5rem]" /></label><select aria-label="Filter status pembayaran" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 px-12 py-10 text-[1.4rem]"><option value="">Semua status</option><option value="PENDING">Menunggu Verifikasi</option><option value="VERIFIED">Terverifikasi</option><option value="REVIEW_REQUIRED">Perlu Ditinjau</option><option value="CANCELLED">Dibatalkan</option></select><label className="text-[1.3rem] text-slate-500">Dari <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-lg border border-slate-300 px-8 py-7 text-slate-700" /></label><label className="text-[1.3rem] text-slate-500">Sampai <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-lg border border-slate-300 px-8 py-7 text-slate-700" /></label><span className="ml-auto text-[1.4rem] text-slate-500">{rows.length} pembayaran</span></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[88rem] text-left text-[1.4rem]"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-12">Referensi</th><th className="p-12">Invoice</th><th className="p-12">Pelanggan</th><th className="p-12">Tanggal</th><th className="p-12 text-right">Nominal</th><th className="p-12">Metode</th><th className="p-12">Status</th><th className="p-12">Aksi</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="p-24 text-center text-slate-500">Memuat pembayaran…</td></tr> : rows.length === 0 ? <tr><td colSpan={8} className="p-24 text-center text-slate-500">Belum ada pembayaran tercatat.</td></tr> : rows.map((payment) => <tr key={payment.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="p-12 font-medium">{payment.reference || '—'}</td><td className="p-12 font-semibold text-slate-800">{payment.invoice.number}</td><td className="p-12">{payment.invoice.customerName}</td><td className="p-12">{formatIdDate(payment.paymentDate)}</td><td className="p-12 text-right">{formatIdr(payment.amount)}</td><td className="p-12">{payment.method}</td><td className="p-12"><span className={clsx('whitespace-nowrap rounded-full px-10 py-5 text-[1.2rem] font-medium', statusColor[payment.status])}>{statusText[payment.status]}</span></td><td className="p-12"><button type="button" onClick={() => void refreshDetail(payment.id).catch((error) => showError('Detail belum dimuat', error instanceof Error ? error.message : 'Periksa backend.'))} className="inline-flex items-center gap-6 text-blue-700 hover:text-blue-900"><Eye size={16} />Detail</button></td></tr>)}</tbody></table></div>
      </section>

      {isFormOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-16" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}><form onSubmit={savePayment} className="max-h-[90vh] w-full max-w-[70rem] overflow-auto rounded-2xl bg-white p-20 shadow-2xl">
        <div className="mb-16 flex items-start justify-between"><div><h2 className="text-[2.4rem] font-bold">Catat Pembayaran</h2><p className="mt-4 text-slate-500">Pembayaran baru berstatus Pending dan belum mengurangi saldo invoice.</p></div><button type="button" onClick={() => setIsFormOpen(false)} aria-label="Tutup form pembayaran" className="rounded-full bg-slate-100 p-8 text-slate-600"><X size={18} /></button></div>
        <div className="grid gap-12 sm:grid-cols-2"><Field label="Invoice"><select required value={form.invoiceId} onChange={(event) => setForm({ ...form, invoiceId: event.target.value })} className="control"><option value="">Pilih invoice aktif</option>{invoices.filter((invoice) => !['DRAFT', 'CANCELLED', 'PAID', 'REVIEW_REQUIRED'].includes(invoice.status) && Number(invoice.balance) > 0).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} — {invoice.customerName} (sisa {formatIdr(invoice.balance)})</option>)}</select></Field><Field label="Nominal Pembayaran"><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="control" /></Field><Field label="Tanggal Pembayaran"><input required type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} className="control" /></Field><Field label="Metode"><select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className="control"><option>Transfer Bank</option><option>Tunai</option><option>Kartu</option><option>QRIS</option><option>Lainnya</option></select></Field><Field label="Referensi Transaksi (opsional)"><input maxLength={150} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} className="control" /></Field><Field label="Keterangan (opsional)"><textarea rows={2} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="control" /></Field><Field label="Bukti Pembayaran (opsional)"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} className="block w-full text-[1.4rem]" /></Field></div>
        {selectedInvoice && <p className="mt-12 rounded-xl bg-blue-50 p-12 text-[1.4rem] text-blue-800">Sisa tagihan saat ini: <strong>{formatIdr(selectedInvoice.balance)}</strong>. Nilai pembayaran tetap divalidasi ulang oleh backend saat disimpan.</p>}
        <div className="mt-16 flex flex-wrap justify-end gap-8"><button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl border border-slate-300 px-14 py-8 text-slate-700">Batal</button>{selectedInvoice && Number(form.amount) > Number(selectedInvoice.balance) && <button type="button" onClick={() => void saveOverpaymentCase()} className="rounded-xl border border-amber-300 bg-amber-50 px-12 py-8 font-medium text-amber-800 hover:bg-amber-100">Catat sebagai Perlu Ditinjau</button>}<button type="submit" className="rounded-xl bg-app-primary px-16 py-8 font-semibold text-white hover:bg-blue-800">Simpan Pending</button></div>
      </form></div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-16" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div className="max-h-[90vh] w-full max-w-[76rem] overflow-auto rounded-2xl bg-white p-20 shadow-2xl">
        <div className="mb-16 flex items-start justify-between gap-12"><div><h2 className="text-[2.4rem] font-bold">Detail Pembayaran</h2><p className="mt-4 text-slate-500">{selected.reference || `Pembayaran ${selected.invoice.number}`}</p></div><div className="flex items-center gap-8"><span className={clsx('rounded-full px-12 py-6 text-[1.3rem] font-medium', statusColor[selected.status])}>{statusText[selected.status]}</span><button type="button" onClick={() => setSelected(null)} aria-label="Tutup detail pembayaran" className="rounded-full bg-slate-100 p-8 text-slate-600"><X size={18} /></button></div></div>
        <div className="grid gap-10 sm:grid-cols-2"><Info label="Invoice" value={`${selected.invoice.number} — ${selected.invoice.customerName}`} /><Info label="Tanggal Pembayaran" value={formatIdDate(selected.paymentDate)} /><Info label="Nominal" value={formatIdr(selected.amount)} /><Info label="Metode" value={selected.method} /><Info label="Referensi" value={selected.reference || '—'} /><Info label="Status Invoice" value={statusText[selected.invoice.status] || selected.invoice.status} /></div>
        {selected.notes && <p className="mt-12 rounded-xl bg-slate-50 p-12 text-slate-600">{selected.notes}</p>}
        <section className="mt-16 rounded-xl border border-slate-200 p-14"><div className="mb-10 flex items-center justify-between gap-12"><h3 className="text-[1.8rem] font-semibold">Bukti Pembayaran</h3>{selected.status !== 'CANCELLED' && <label className="cursor-pointer text-[1.4rem] font-medium text-blue-700 hover:text-blue-900"><Paperclip className="mr-5 inline" size={15} />Tambah file<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void uploadAttachment(selected, file) }} /></label>}</div>
          {selected.attachments.length ? <ul className="divide-y divide-slate-100">{selected.attachments.map((file) => <li key={file.id} className="flex min-w-0 items-center gap-8 py-8"><Paperclip size={15} className="shrink-0 text-slate-400" /><a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-words text-blue-700 hover:underline">{file.name}</a><span className="text-[1.2rem] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>{selected.status === 'PENDING' && <button type="button" onClick={() => void deleteAttachment(selected, file)} className="text-rose-600 hover:text-rose-800">Hapus</button>}</li>)}</ul> : <p className="text-[1.4rem] text-slate-500">Belum ada bukti terunggah.</p>}
        </section>
        {selected.history?.length ? <section className="mt-16 rounded-xl border border-slate-200 p-14"><h3 className="mb-8 font-semibold">Riwayat Pembayaran</h3><ul className="space-y-6 text-[1.3rem] text-slate-600">{selected.history.map((entry) => <li key={entry.id}>{formatIdDate(entry.createdAt)} · {entry.fromStatus ? statusText[entry.fromStatus] : '—'} → {statusText[entry.toStatus] || entry.toStatus}{entry.note ? ` — ${entry.note}` : ''}</li>)}</ul></section> : null}
        <div className="mt-16 flex flex-wrap justify-end gap-8">{selected.status === 'PENDING' && <button type="button" onClick={() => void verifyPayment(selected)} disabled={!verificationConfigured} className="inline-flex items-center gap-6 rounded-xl bg-emerald-600 px-14 py-8 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={16} />Verifikasi</button>}{selected.status !== 'CANCELLED' && <button type="button" onClick={() => void cancelPayment(selected)} className="rounded-xl border border-rose-200 px-12 py-8 font-medium text-rose-700 hover:bg-rose-50">Batalkan</button>}<button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-14 py-8 text-slate-700">Tutup</button></div>
      </div></div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-5 block text-[1.4rem] font-medium text-slate-700">{label}</span>{children}</label>
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-12"><p className="text-[1.3rem] text-slate-500">{label}</p><p className="mt-4 break-words font-medium text-slate-800">{value}</p></div>
}
