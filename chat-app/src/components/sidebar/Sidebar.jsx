import React, { useContext, useMemo, useState, useEffect } from "react"
import assets from "../../assets/assets"
import { Appcontext } from "../../context/Appcontext"
import { logout } from "../../config/firebase"
import { useNavigate } from "react-router-dom"
import NavigationMenu from "./NavigationMenu"
import ContactsList from "./ContactsList"
import UserCard from "./UserCard"

const Sidebar = ({ setMobileView }) => {
  const navigate = useNavigate()
  const {
    userdata,
    allUsers,
    userChats,
    selectedChatUser,
    setSelectedChatUser,
    unreadChats,
    markChatAsRead,
    theme,
    setTheme,
  } = useContext(Appcontext)

  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [activeTab, setActiveTab] = useState("messages") // 'messages' | 'contacts' | 'settings'

  const totalUnread = useMemo(() => {
    return Object.values(unreadChats || {}).reduce((a, b) => a + b, 0);
  }, [unreadChats])

  const [deferredPrompt, setDeferredPrompt] = useState(null)
  
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      alert("To install Samlap:\n\n💻 On PC: Click the install icon (a screen with an arrow) in the far right of your browser's address bar.\n\n📱 On Mobile: Tap your browser's menu (⋮) or Share button and select 'Add to Home Screen'.")
    }
  }

  const handleSelectUser = (user) => {
    setSelectedChatUser(user)
    setSearchQuery("")
    setShowSearch(false)
    if (unreadChats[user.uid]) {
      markChatAsRead(user.uid)
    }
    if (setMobileView) setMobileView("chat")
  }

  const handleLogout = async () => {
    await logout()
    navigate("/")
  }

  const navItems = [
    {
      id: "messages",
      label: "Chats",
      icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
    },
    {
      id: "contacts",
      label: "Contacts",
      icon: "M12 4.354l1.102 1.103a1.5 1.5 0 010 2.122l-1.102 1.103m-7.154 0L3.744 7.58a1.5 1.5 0 010-2.122l1.102-1.103m0 0a1.5 1.5 0 012.122 0l1.103 1.102m-1.103-1.102l-1.102 1.103m0 0a1.5 1.5 0 010 2.122l1.102 1.103m4.354-4.354l-1.103 1.102m1.103-1.102l1.102 1.103m0 0a1.5 1.5 0 010 2.122l-1.102 1.103",
    },
    {
      id: "theme",
      label: "Theme",
      icon: theme === 'light' ? "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" : "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z",
      onClick: () => setTheme(prev => prev === 'light' ? 'dark' : 'light'),
    },
    {
      id: "settings",
      label: "Settings",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756-2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
    {
      id: "install",
      label: "Install",
      icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
      onClick: handleInstallClick,
    },
    {
      id: "logout",
      label: "Logout",
      icon: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
      onClick: handleLogout,
    }
  ]

  const filteredUsers = allUsers.filter(
    (u) => u.uid !== userdata?.uid && u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const recentChatUsers = useMemo(() =>{
    return userChats
    .map((chat) => ({
      ...allUsers.find((u) => u.uid === chat.recipient_id),
      lastMsg: chat.last_msg,
      updatedAt: chat.updated_at,
      unread: chat.unread || 0,
    }))
    .filter((u) => u && u.uid)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [userChats, allUsers])

  return (
    <div className="flex flex-col lg:flex-row bg-white dark:bg-[#051424] w-full h-full relative overflow-hidden">
      {/* Left Nav Rail — 64px icon-only on desktop, hidden on mobile */}
      <div className="hidden lg:flex w-[64px] bg-slate-50 dark:bg-[#122131] flex-col items-center py-6 gap-2 flex-shrink-0 border-r border-slate-200 dark:border-[#122131] relative z-10">
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#202c33] shadow-sm flex items-center justify-center mb-2">
          <img src={assets.logo_icon} className="w-5 h-5" alt="logo" />
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          className="w-10 h-10 mb-4 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-all duration-200"
        >
          {theme === 'light' ? (
            /* Moon Icon */
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            /* Sun Icon */
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
            </svg>
          )}
        </button>

        <NavigationMenu
          navItems={navItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleLogout={handleLogout}
          totalUnread={totalUnread}
        />
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-[#051424] overflow-hidden border-r border-slate-100 dark:border-transparent">
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[24px] font-bold text-blue-600 dark:text-[#b4c5ff] tracking-tight">Messages</h2>
            <button onClick={() => setActiveTab("contacts")} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 dark:text-[#c3c6d7] hover:bg-slate-100 dark:hover:bg-[#c3c6d7]/10 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 pt-4 pb-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 dark:text-[#c3c6d7] group-focus-within:text-blue-500 dark:group-focus-within:text-[#b4c5ff] transition-colors z-10">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full bg-slate-50 dark:bg-[#1c2b3c] border-none rounded-xl py-3 pr-4 text-[14px] text-slate-700 dark:text-[#d4e4fa] focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-[#b4c5ff]/50 transition-all placeholder:text-slate-400 dark:placeholder:text-[#c3c6d7]/60 outline-none"
              style={{ paddingLeft: '3.5rem' }}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearch(e.target.value.length > 0)
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {showSearch && searchQuery ? (
            <div className="flex flex-col space-y-2">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <UserCard
                    key={user.uid}
                    user={user}
                    isSelected={selectedChatUser?.uid === user.uid}
                    onClick={() => handleSelectUser(user)}
                    isOnline={user.online}
                    unread={user.unread}
                  />
                ))
              ) : (
                <p className="p-8 text-center text-slate-400 text-sm">No matches found</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col space-y-2">
              {recentChatUsers.map((user) => (
                <UserCard
                  key={user.uid}
                  user={user}
                  lastMsg={user.lastMsg}
                  isSelected={selectedChatUser?.uid === user.uid}
                  onClick={() => handleSelectUser(user)}
                  isOnline={user.online}
                  unread={user.unread}
                />
              ))}

              {recentChatUsers.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm">Your inbox is empty</div>
              )}
            </div>
          )}
        </div>
        {/* Spacer for mobile bottom nav */}
        <div className="lg:hidden w-full flex-shrink-0" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}></div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white dark:bg-[#122131] border-t border-slate-200 dark:border-transparent flex items-center justify-around px-2 z-[60] shadow-[0_-4px_20px_rgba(0,0,0,0.02)] dark:shadow-none" style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id && item.id !== 'theme' && item.id !== 'logout';
          return (
            <button 
              key={item.id}
              onClick={() => {
                if (item.onClick) item.onClick();
                else setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center h-full gap-[4px] transition-all flex-1 relative ${isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"}`}
            >
              <div className={`px-[18px] py-[4px] rounded-full transition-all relative ${isActive ? "bg-slate-200/70 dark:bg-slate-700/80" : "bg-transparent"}`}>
                <svg className={`w-[22px] h-[22px]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? "2.5" : "2"} d={item.icon}></path>
                </svg>
                {item.id === "messages" && totalUnread > 0 && (
                  <span className="absolute top-0 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full shadow-sm">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
              <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
            </button>
          )
        })}
      </div>

      <ContactsList
        activeTab={activeTab}
        allUsers={allUsers}
        userdata={userdata}
        handleSelectUser={handleSelectUser}
      />
    </div>
  )
}

export default Sidebar
