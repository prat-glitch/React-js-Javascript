import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, List, Target, Settings, LogOut, Sun, Moon, ChevronRight, Menu, X, User, Bell
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { useUser } from "../context/UserContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";

// Navigation items
const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: List, label: "Transactions", path: "/all-transactions" },
  { icon: Target, label: "Budget", path: "/budget" },
  { icon: User, label: "Profile", path: "/profile" }
];

// Helper function
const getInitials = (name) => {
  return name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "U";
};

// ==========================================
// MOBILE TOP BAR COMPONENT
// ==========================================
export const MobileHeader = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { isDarkMode } = useTheme();
  const { user } = useUser();
  const { togglePanel, unreadCount } = useNotification();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <header className={`
      lg:hidden sticky top-0 z-40 px-4 py-3
      ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}
    `}>
      <div className="flex items-center justify-between">
        {/* Left: Hamburger + Greeting */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 bg-[#15734C]/20 text-[#10b981] border border-[#15734C]/30 hover:bg-[#15734C]/30 shadow-lg shadow-[#15734C]/10"
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={2.5} />
          </button>
          <div>
            <p className="text-xs text-gray-500">
              {getGreeting()}
            </p>
            <p className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {user?.name?.split(' ')[0] || 'User'}
            </p>
          </div>
        </div>

        {/* Right: Notifications + Avatar */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePanel}
            className="relative w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95 bg-[#15734C]/10 text-[#10b981] border border-[#15734C]/20 hover:bg-[#15734C]/20"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#15734C] rounded-full ring-2 ring-[#0a0a0a]" />
            )}
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="w-11 h-11 rounded-xl overflow-hidden ring-2 ring-[#15734C]/30 active:scale-95 transition-transform"
            aria-label="Profile"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-linear-to-br from-[#15734C] to-[#10b981] flex items-center justify-center text-white text-sm font-bold">
                {getInitials(user?.name)}
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

// ==========================================
// MOBILE BOTTOM NAVIGATION
// ==========================================
export const BottomNavigation = () => {
  const { isDarkMode } = useTheme();
  const location = useLocation();

  return (
    <nav className={`
      lg:hidden fixed bottom-0 left-0 right-0 z-50
      ${isDarkMode ? 'bg-[#0a0a0a] border-t border-[#15734C]/20' : 'bg-[#0a0a0a] border-t border-[#15734C]/10'}
    `}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center gap-1 
                min-w-[60px] min-h-12 py-1.5 px-2 rounded-xl
                transition-all duration-200 active:scale-95
                ${isActive
                  ? (isDarkMode ? 'text-[#15734C]' : 'text-[#15734C]')
                  : (isDarkMode ? 'text-slate-500' : 'text-slate-400')}
              `}
            >
              <div className={`
                p-1.5 rounded-xl transition-colors
                ${isActive
                  ? (isDarkMode ? 'bg-[#15734C]/20' : 'bg-[#15734C]/10')
                  : 'bg-transparent'}
              `}>
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// ==========================================
// MOBILE OVERLAY
// ==========================================
export const MobileOverlay = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  if (!isMobileMenuOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
      onClick={() => setIsMobileMenuOpen(false)}
    />
  );
};

// ==========================================
// MAIN SIDEBAR COMPONENT
// ==========================================
const Sidebar = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useUser();
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* ==================== */}
      {/* MOBILE SLIDE-OUT MENU */}
      {/* ==================== */}
      <aside className={`
        lg:hidden fixed inset-y-0 left-0 z-50 w-72
        transform transition-transform duration-300 ease-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-[#0a0a0a]'}
      `}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#15734C] to-[#10b981] flex items-center justify-center text-white font-bold shadow-lg shadow-[#15734C]/25">
              ₹
            </div>
            <span className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              ExpenseTrack
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4">
          <button
            onClick={() => handleNavigation('/profile')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-750' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-linear-to-br from-[#15734C] to-[#10b981] flex items-center justify-center text-white font-bold">
              {user?.avatar ? (
                <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div className="flex-1 text-left">
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {user?.name || 'User'}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                View Profile
              </p>
            </div>
            <ChevronRight size={18} className={isDarkMode ? 'text-slate-600' : 'text-slate-400'} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-2 flex-1 overflow-y-auto pb-48">
          <p className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Menu
          </p>
          <div className="space-y-1">
            {[...navItems, { icon: Settings, label: "Settings", path: "/settings" }].map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm
                    transition-all duration-200 min-h-12
                    ${isActive
                      ? (isDarkMode
                        ? 'bg-[#15734C]/15 text-[#15734C]'
                        : 'bg-[#15734C]/10 text-[#15734C]')
                      : (isDarkMode
                        ? 'text-slate-300 hover:bg-slate-800'
                        : 'text-slate-600 hover:bg-slate-50')}
                  `}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 pb-20 border-t ${isDarkMode ? 'border-[#15734C]/20 bg-[#0a0a0a]' : 'border-[#15734C]/10 bg-[#0a0a0a]'}`}>
          <div className="space-y-2">
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm min-h-12 ${isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium text-sm min-h-12 ${isDarkMode ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`}
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* ==================== */}
      {/* DESKTOP SIDEBAR */}
      {/* ==================== */}
      <aside className={`
        hidden lg:flex
        fixed inset-y-0 left-0 z-50 w-64 xl:w-72 flex-col
        ${isDarkMode ? 'bg-[#0a0a0a] border-r border-[#15734C]/20' : 'bg-[#0a0a0a] border-r border-[#15734C]/10'}
      `}>
        {/* Logo */}
        <div className={`p-5 xl:p-6 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 xl:w-11 xl:h-11 flex items-center justify-center rounded-xl bg-linear-to-br from-[#15734C] to-[#10b981] text-white font-bold shadow-lg shadow-[#15734C]/25">₹</div>
            <span className={`font-bold text-lg xl:text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>ExpenseTrack</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 xl:p-5 overflow-y-auto">
          <p className={`text-[10px] xl:text-xs font-semibold uppercase tracking-wider px-3 mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Menu</p>
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`
                    flex items-center gap-3 xl:gap-4 px-3 xl:px-4 py-2.5 xl:py-3 rounded-xl xl:rounded-2xl font-medium text-sm xl:text-base
                    transition-all duration-200
                    ${isActive
                      ? (isDarkMode
                        ? 'bg-linear-to-r from-[#15734C]/20 to-[#10b981]/20 text-[#15734C] border border-[#15734C]/30'
                        : 'bg-linear-to-r from-[#15734C]/10 to-[#10b981]/10 text-[#15734C] border border-[#15734C]/20')
                      : (isDarkMode
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                        : 'text-slate-500 hover:text-[#15734C] hover:bg-[#15734C]/5')}
                  `}
                >
                  <item.icon size={18} className="xl:w-5 xl:h-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User & Settings */}
        <div className={`p-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-3 p-3 rounded-xl mb-3 cursor-pointer transition-all ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#15734C]/5'}`}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-medium text-sm overflow-hidden bg-linear-to-br from-[#15734C] to-[#10b981] text-white">
              {user?.avatar ? (
                <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span>{getInitials(user?.name || "User")}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                {user?.name || "User"}
              </p>
              <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>View Profile</p>
            </div>
            <ChevronRight size={16} className={isDarkMode ? 'text-slate-600' : 'text-slate-300'} />
          </div>

          <div className="space-y-1">
            <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-[#15734C] hover:bg-[#15734C]/5'}`}
            >
              <Settings size={18} />
              Settings
            </Link>
            <button
              onClick={toggleTheme}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-[#15734C] hover:bg-[#15734C]/5'}`}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-medium text-sm cursor-pointer transition-all ${isDarkMode ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-500 hover:bg-rose-50'}`}
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Bottom Navigation for Mobile */}
      <BottomNavigation />
    </>
  );
};

export default Sidebar;
