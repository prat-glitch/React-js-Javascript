import React from "react"

const NavigationMenu = ({ navItems, activeTab, setActiveTab, handleLogout }) => {
  return (
    <nav className="flex flex-col items-center gap-1 flex-1 w-full px-2">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          title={item.label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeTab === item.id
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          }`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
          </svg>
        </button>
      ))}

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1 mt-auto w-full px-0 pt-4 border-t border-slate-200">
        <button
          title="Help"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all group"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </nav>
  )
}

export default NavigationMenu
