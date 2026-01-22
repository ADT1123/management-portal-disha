import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Calendar, 
  Settings,
  BarChart3, // ✅ Add this import
  LogOut 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['superadmin', 'admin', 'member'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['superadmin', 'admin', 'member'] },
  { name: 'Team', href: '/team', icon: Users, roles: ['superadmin', 'admin'] },
  { name: 'Meetings', href: '/meetings', icon: Calendar, roles: ['superadmin', 'admin', 'member'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['superadmin'] }, // ✅ Add this line
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['superadmin', 'admin', 'member'] },
];

export const Sidebar = () => {
  const { userData, userRole, logout } = useAuth();

  return (
    <div className="flex h-screen w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-primary-600">Portal</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation
          .filter(item => userRole && item.roles.includes(userRole))
          .map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
      </nav>

      {/* User Profile */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center mb-3">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {userData?.displayName?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {userData?.displayName}
            </p>
            <p className="text-xs text-gray-500 uppercase">{userRole}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Log out
        </button>
      </div>
    </div>
  );
};
