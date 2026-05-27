import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getExpiringItems } from '../../api/inventory'

const links = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/inventory', label: 'Pantry', icon: '📦' },
  { to: '/scan', label: 'Scan', icon: '📷' },
  { to: '/shopping-list', label: 'Shop', icon: '🛒' },
  { to: '/recipes', label: 'Recept', icon: '🍳' },
  { to: '/add', label: 'Add', icon: '➕' },
]

export default function Navbar() {
  const { data: expiring = [] } = useQuery({
    queryKey: ['expiring'],
    queryFn: getExpiringItems,
    staleTime: 60_000,
  })

  const urgentCount = expiring.filter((i) => {
    if (!i.expiryDate) return false
    const days = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 3
  }).length

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
              <span className="relative text-lg leading-none md:text-base">
                {icon}
                {to === '/inventory' && urgentCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none px-0.5">
                    {urgentCount > 9 ? '9+' : urgentCount}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
