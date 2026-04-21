import React from "react"

const NavigationMenu = ({ navItems, activeTab, setActiveTab, handleLogout }) => {
  return (
    <nav className="flex flex-col gap-3 flex-1">
      {navItems.map((item) => (
        <button 
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${activeTab === item.id ? "bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-blue-600" : "text-slate-500 hover:bg-white/50 hover:text-slate-800"}`}
        >
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
          </svg>
          <span className="hidden lg:block font-bold text-sm">{item.label}</span>
        </button>
      ))}

      <div className="flex flex-col gap-2 mt-auto border-t border-slate-200 pt-4">
        <button className="flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-500 hover:bg-white/50 hover:text-slate-800 transition-all">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden lg:block font-bold text-sm">Help</span>
        </button>
        <button onClick={handleLogout} className="flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all group">
          <svg className="w-6 h-6 flex-shrink-0 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span className="hidden lg:block font-bold text-sm">Logout</span>
        </button>
      </div>
    </nav>
  )
}

export default NavigationMenu
