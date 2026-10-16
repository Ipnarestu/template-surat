import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ChevronFirst, ChevronLast } from 'lucide-react'
import { useLoading } from '@/hooks/useLoading'
import { DialogLoading } from '@/components/feedback/dialogComponents'
import { ErrorBoundary } from '../pages/errorPage/errorBoundary'
import ErrorPage from '@/pages/errorPage'
import Header from './components/header'
import Navigation from './components/navigation'

export default function MainLayout() {
  const { isLoading, setIsLoading } = useLoading()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-screen w-full flex-col bg-app-background text-left font-jakarta text-[2rem] leading-[1.4] text-slate-800">
      <Header onMenuClick={() => setIsMobileOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Sidebar navigasi"
          className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white px-12 py-20 transition-[width] duration-200 desktop:flex ${isCollapsed ? 'w-[8rem]' : 'w-[24rem]'}`}
        >
          <div className="mb-16 flex items-center justify-between px-8">
            {!isCollapsed && <span className="text-[1.3rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Menu</span>}
            <button
              aria-label={isCollapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
              onClick={() => setIsCollapsed((value) => !value)}
              className="ml-auto inline-flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary"
            >
              {isCollapsed ? <ChevronLast size={16} /> : <ChevronFirst size={16} />}
            </button>
          </div>
          <Navigation collapsed={isCollapsed} />
        </aside>

        {isMobileOpen && (
          <div className="fixed inset-0 z-40 desktop:hidden">
            <button
              aria-label="Tutup menu navigasi"
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setIsMobileOpen(false)}
            />
            <aside aria-label="Sidebar navigasi" className="absolute bottom-0 left-0 top-[6.8rem] w-[min(30rem,85vw)] overflow-y-auto border-r border-slate-200 bg-white p-16 shadow-xl">
              <div className="mb-16 px-8 text-[1.3rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Menu</div>
              <Navigation onNavigate={() => setIsMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden px-24 py-24 phones:px-12 phones:py-16">
          <ErrorBoundary fallback={<ErrorPage />}>
            <Outlet key={location.pathname} />
          </ErrorBoundary>
        </main>
      </div>
      <DialogLoading isOpen={isLoading} setIsOpen={setIsLoading} />
    </div>
  )
}
