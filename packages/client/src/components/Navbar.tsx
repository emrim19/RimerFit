import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const desktopLinkCls = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? 'text-amber-500' : 'text-stone-500 hover:text-stone-200'}`

const bottomLinkCls = ({ isActive }: { isActive: boolean }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
    isActive ? 'text-amber-500' : 'text-stone-500'
  }`

export default function Navbar() {
  const { signOut } = useAuth()

  return (
    <>
      {/* Top bar */}
      <nav className="border-b border-stone-800 bg-stone-950 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-stone-100">RimerFit</span>
            {/* Desktop-only nav links */}
            <div className="hidden items-center gap-6 sm:flex">
              <NavLink to="/" end className={desktopLinkCls}>Dashboard</NavLink>
              <NavLink to="/history" className={desktopLinkCls}>History</NavLink>
              <NavLink to="/progress" className={desktopLinkCls}>Progress</NavLink>
              <NavLink to="/metrics" className={desktopLinkCls}>Metrics</NavLink>
            </div>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-stone-500 hover:text-stone-100"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-800 bg-stone-950 sm:hidden">
        <div className="flex">
          <NavLink to="/" end className={bottomLinkCls}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V20a.5.5 0 00.5.5h5v-5h5v5h5a.5.5 0 00.5-.5v-9.5" />
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/history" className={bottomLinkCls}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            History
          </NavLink>
          <NavLink to="/progress" className={bottomLinkCls}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 4 4-6 4 3" />
            </svg>
            Progress
          </NavLink>
          <NavLink to="/metrics" className={bottomLinkCls}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Metrics
          </NavLink>
        </div>
      </nav>
    </>
  )
}
