import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit,
  where,
  onSnapshot,
  updateDoc,
  doc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { TeamChatDrawer } from '../chat/TeamChatDrawer';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Calendar, 
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Trophy,
  Medal,
  Star,
  BellDot,
  Check,
  CheckCheck,
  MessageCircle
} from 'lucide-react';


interface LayoutProps {
  children: React.ReactNode;
}


interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'task' | 'meeting' | 'announcement' | 'achievement' | 'general';
  read: boolean;
  createdAt: Timestamp;
  userId: string;
}


export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, userData, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);


  // Real-time notifications listener
  useEffect(() => {
    if (!currentUser?.uid) return;


    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );


    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.read).length);
    });


    return () => unsubscribe();
  }, [currentUser]);


  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };


  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };


  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };


  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(notification => 
          updateDoc(doc(db, 'notifications', notification.id), { read: true })
        )
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };


  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'achievement': return <Trophy className="h-4 w-4" />;
      case 'announcement': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };


  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-100 text-blue-600';
      case 'meeting': return 'bg-purple-100 text-purple-600';
      case 'achievement': return 'bg-yellow-100 text-yellow-600';
      case 'announcement': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };


  const formatNotificationTime = (timestamp: Timestamp) => {
    const now = new Date();
    const notificationDate = timestamp.toDate();
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);


    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notificationDate.toLocaleDateString();
  };


  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { path: '/team', icon: Users, label: 'Team' },
    { path: '/meetings', icon: Calendar, label: 'Meetings' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];


  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1: return <Medal className="h-5 w-5 text-gray-400" />;
      case 2: return <Medal className="h-5 w-5 text-orange-600" />;
      default: return <Star className="h-4 w-4 text-gray-400" />;
    }
  };


  const getRankColor = (index: number) => {
    switch (index) {
      case 0: return 'bg-yellow-50 border-yellow-200';
      case 1: return 'bg-gray-50 border-gray-200';
      case 2: return 'bg-orange-50 border-orange-200';
      default: return 'bg-white border-gray-100';
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeMobileMenu}
        />
      )}


      {/* Notification Overlay */}
      {isNotificationOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsNotificationOpen(false)}
        />
      )}


      {/* Sidebar - Desktop & Mobile */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0 z-50' : '-translate-x-full'}
          lg:translate-x-0 lg:static
          w-64 flex-shrink-0 overflow-y-auto
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
            <h1 className="text-xl font-bold text-primary-600">Manage eka</h1>
            <button
              onClick={closeMobileMenu}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>


          {/* Navigation */}
          <nav className="py-6 px-3 border-b border-gray-200">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileMenu}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                      ${isActive 
                        ? 'bg-primary-50 text-primary-600 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Team Chat Button */}
              <button
                onClick={() => {
                  setChatOpen(true);
                  closeMobileMenu();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-all"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Team Chat</span>
              </button>
            </div>
          </nav>
          {/* User Profile & Logout */}
          <div className="border-t border-gray-200 p-4 flex-shrink-0">
            <div className="flex items-center space-x-3 mb-3 px-2">
              <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-semibold text-sm">
                  {userData?.displayName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userData?.displayName}
                </p>
                <p className="text-xs text-gray-500 uppercase">
                  {userData?.role}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                handleLogout();
                closeMobileMenu();
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>


      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen w-full lg:w-auto">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-primary-600">Portal</h1>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setChatOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <MessageCircle className="h-5 w-5 text-gray-600" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
              >
                {unreadCount > 0 ? (
                  <BellDot className="h-5 w-5 text-gray-600" />
                ) : (
                  <Bell className="h-5 w-5 text-gray-600" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-semibold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>


        {/* Desktop Header */}
        <header className="hidden lg:block sticky top-0 z-20 bg-white border-b border-gray-200 px-8 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search..."
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setChatOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Team Chat"
              >
                <MessageCircle className="h-5 w-5 text-gray-600" />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
                >
                  {unreadCount > 0 ? (
                    <BellDot className="h-5 w-5 text-gray-600" />
                  ) : (
                    <Bell className="h-5 w-5 text-gray-600" />
                  )}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-semibold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>


        {/* Notification Dropdown */}
        {isNotificationOpen && (
          <div className="fixed top-16 right-4 lg:top-20 lg:right-8 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
            {/* Notification Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>


            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          markAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${getNotificationColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-blue-600 rounded-full flex-shrink-0 ml-2 mt-1"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatNotificationTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <Bell className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No notifications yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    We'll notify you when something important happens
                  </p>
                </div>
              )}
            </div>

            {/* Notification Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-200 text-center">
                <button
                  onClick={() => {
                    setIsNotificationOpen(false);
                    navigate('/notifications');
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        )}


        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 mt-16 lg:mt-0 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Team Chat Drawer */}
      <TeamChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};