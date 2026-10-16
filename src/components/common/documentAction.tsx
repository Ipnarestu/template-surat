import { AlertCircle, Download, Printer } from 'lucide-react'
import { showError, showSuccess } from '@/utils/notifications'

export default function DocumentActions({
  onOpen,
  onPrint,
  onDownload,
}: {
  onOpen: () => void
  onPrint: () => void
  onDownload: () => void | Promise<void>
}) {
  const handleDownload = async () => {
    try {
      await onDownload()
      await showSuccess('File PDF berhasil dibuat')
    } catch {
      await showError('Gagal membuat PDF', 'Periksa kembali data dokumen dan coba lagi.')
    }
  }

  return (
    <div className="flex items-center gap-16">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex min-h-[4rem] items-center gap-12 rounded-xl border border-slate-300 px-16 py-8 text-[1.6rem] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary"
      >
        <AlertCircle size={12} />
        <p>Open</p>
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="inline-flex min-h-[4rem] items-center gap-12 rounded-xl border border-slate-300 px-16 py-8 text-[1.6rem] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary"
      >
        <Printer size={12} />
        <p>Print</p>
      </button>
      <button
        type="button"
        onClick={() => void handleDownload()}
        className="inline-flex min-h-[4rem] items-center gap-12 rounded-xl border border-slate-300 px-16 py-8 text-[1.6rem] font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary"
      >
        <Download size={12} />
        <p>Download</p>
      </button>
    </div>
  )
}
