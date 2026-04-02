import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/inventory', label: 'Pantry', icon: '📦' },
  { to: '/scan', label: 'Scan', icon: '📷' },
  { to: '/shopping-list', label: 'Shop', icon: '🛒' },
  { to: '/add', label: 'Add', icon: '➕' },
]

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:static md:border-t-0 md:border-b md:mb-4">
      <ul className="flex items-center justify-around md:justify-start md:gap-1 md:px-4 md:max-w-2xl md:mx-auto">
        {links.map(({ to, label, icon }) => (
          <li key={to} className="flex-1 md:flex-none">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5 py-2 px-3 text-xs font-medium transition-colors min-h-[48px] md:flex-row md:gap-2 md:text-sm md:rounded-md md:px-4',
                  isActive
                    ? 'text-brand-600 md:bg-brand-50'
                    : 'text-gray-500 hover:text-brand-600 md:hover:bg-gray-100',
                ].join(' ')
              }
            >
              <span className="text-lg leading-none md:text-base">{icon}</span>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
