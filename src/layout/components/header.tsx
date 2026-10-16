import { useNavigate } from 'react-router-dom'
import UserProfile from './userProfil'
import { usePathname } from '@/hooks/usePathname'
import { ChevronLeft, Menu } from 'lucide-react'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate()
  const { splittedPath } = usePathname()

  return (
    <header className="flex min-h-[6.8rem] w-full items-center justify-between gap-16 border-b border-slate-200 bg-white px-20 py-10 phones:px-12">
      <div className="flex min-w-0 items-center gap-12">
        <button
          aria-label="Buka menu navigasi"
          onClick={onMenuClick}
          className="inline-flex h-[4rem] w-[4rem] shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary desktop:hidden"
        >
          <Menu size={20} />
        </button>
        <button
          onClick={() => navigate(splittedPath?.length >= 3 ? '/surat' : '/')}
          className="group flex min-w-0 items-center gap-10 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary"
        >
          {splittedPath?.length >= 3 ? (
            <>
              <ChevronLeft size={18} className="shrink-0" />
              <span className="truncate text-[1.8rem] font-semibold text-slate-700">Kembali</span>
            </>
          ) : (
            <>
              <img src="/favicon/logo.png" alt="" className="h-[3.8rem] w-[3.8rem] shrink-0 object-contain" />
              <span className="truncate text-[2rem] font-bold uppercase tracking-[0.1em] text-slate-800">Luma</span>
            </>
          )}
        </button>
      </div>
      <UserProfile />
    </header>
  )
}
