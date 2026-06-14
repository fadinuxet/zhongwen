import { NavLink, Outlet } from 'react-router-dom'
import { HomeIcon, LibraryIcon, PlusIcon, PracticeIcon, SettingsIcon } from './Icons'

const tabs = [
  { to: '/', label: 'Today', Icon: HomeIcon },
  { to: '/library', label: 'Library', Icon: LibraryIcon },
  { to: '/capture', label: 'Add', Icon: PlusIcon },
  { to: '/practice', label: 'Practice', Icon: PracticeIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Layout() {
  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex sm:w-52 sm:flex-col sm:border-r sm:border-slate-200 sm:p-4">
        <div className="mb-8 px-2">
          <div className="font-hanzi text-2xl font-bold text-slate-900">学中文</div>
          <div className="text-xs text-slate-400">Chinese Study</div>
        </div>
        <nav className="flex flex-col gap-1">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content — min-w-0 keeps grids/rails from overflowing the flex row. */}
      <main className="min-w-0 flex-1 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/90 backdrop-blur sm:hidden">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`
            }
          >
            <Icon className="h-6 w-6" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
