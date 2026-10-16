import { ArrowRight, ClipboardList, FileStack, FileText, ReceiptText, WalletCards } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const cards = [
  { title: 'Surat', description: 'Buat surat penawaran, permintaan barang, pesanan, dan perjanjian.', route: '/surat', icon: FileStack },
  { title: 'Quotation', description: 'Kelola dokumen penawaran, status, follow up, dan ekspor Excel.', route: '/quotation', icon: FileText },
  { title: 'PO', description: 'Pencatatan Purchase Order masuk dan relasikan dengan quotation.', route: '/po', icon: ClipboardList },
  { title: 'Invoice', description: 'Kelola tagihan berdasarkan PO, Quotation, atau transaksi.', route: '/invoice', icon: ReceiptText },
  { title: 'Bukti Bayar', description: 'Catat, verifikasi, dan telusuri pembayaran invoice.', route: '/bukti-bayar', icon: WalletCards },
]

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="scrollbar flex h-full w-full min-w-0 flex-col gap-24 overflow-auto py-8">
      <div className="flex flex-col gap-8">
        <h1 className="text-[3.2rem] font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500">Pilih modul utama untuk mengelola penawaran, PO, invoice, dan bukti pembayaran.</p>
      </div>

      <div className="grid grid-cols-4 gap-16 laptop:grid-cols-2 phones:grid-cols-1">
        {cards.map(({ title, description, route, icon: Icon }) => (
          <button
            key={title}
            onClick={() => navigate(route)}
            className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-20 text-left shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary"
          >
            <div className="mb-16 flex items-center justify-between gap-12">
              <span className="flex h-[4.8rem] w-[4.8rem] shrink-0 items-center justify-center rounded-full bg-blue-50 text-app-primary">
                <Icon aria-hidden="true" size={20} />
              </span>
              <ArrowRight aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" size={18} />
            </div>
            <div className="space-y-8">
              <p className="text-[2.2rem] font-semibold text-slate-800">{title}</p>
              <p className="text-[1.6rem] leading-[1.5] text-slate-500">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
