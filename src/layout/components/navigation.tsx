import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { navigationItems } from './navigationItems'

export default function Navigation({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-8">
      {navigationItems.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            clsx(
              'group flex min-h-[4.4rem] min-w-0 items-center gap-12 rounded-xl px-12 py-10 text-[1.8rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary',
              collapsed && 'justify-center px-8',
              isActive
                ? 'bg-app-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <Icon aria-hidden="true" className="h-[2rem] w-[2rem] shrink-0" />
          {!collapsed && <span className="min-w-0 truncate">{label}</span>}
          {collapsed && <span className="sr-only">{label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
