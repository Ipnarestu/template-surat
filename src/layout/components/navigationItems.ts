import { ClipboardList, FileStack, FileText, Home, ReceiptText, WalletCards } from 'lucide-react'

export const navigationItems = [
  { label: 'Home', to: '/', icon: Home, end: true },
  { label: 'Quotation', to: '/quotation', icon: FileText },
  { label: 'Surat', to: '/surat', icon: FileStack },
  { label: 'PO', to: '/po', icon: ClipboardList },
  { label: 'Invoice', to: '/invoice', icon: ReceiptText },
  { label: 'Bukti Bayar', to: '/bukti-bayar', icon: WalletCards },
]
