import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/syllabus', label: 'Syllabus' },
  { to: '/log', label: 'Log' },
  { to: '/exams', label: 'Exams' },
  { to: '/dashboard', label: 'Dashboard' },
]

export function Layout() {
  const { profile, logout } = useAuth()

  return (
    <div className="min-h-screen bg-surface md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-line bg-white md:flex md:flex-col">
        <div className="border-b border-line px-5 py-5">
          <span className="text-lg font-semibold tracking-tight text-ink-900">Prepify</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-ink-700 hover:bg-ink-900/5'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-sm font-medium text-ink-900">{profile?.username}</p>
          <button
            onClick={logout}
            className="mt-2 text-sm text-ink-500 hover:text-accent-600"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
          <span className="text-base font-semibold text-ink-900">Prepify</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-700">{profile?.username}</span>
            <button onClick={logout} className="text-sm text-ink-500">
              Log out
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden items-center justify-end border-b border-line bg-white px-6 py-3 md:flex">
          <span className="text-sm text-ink-500">Signed in as</span>
          <span className="ml-2 text-sm font-medium text-ink-900">{profile?.username}</span>
        </header>

        <main className="flex-1 px-4 pb-20 pt-4 md:px-8 md:pb-8 md:pt-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white md:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex-1 py-2 text-center text-xs font-medium ${
                  isActive ? 'text-accent-600' : 'text-ink-500'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
