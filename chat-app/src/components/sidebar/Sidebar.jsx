import React, { useContext, useMemo, useState } from "react"
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
      label: "Chat",
      icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
    },
    {
      id: "contacts",
      label: "Contacts",
      icon: "M12 4.354l1.102 1.103a1.5 1.5 0 010 2.122l-1.102 1.103m-7.154 0L3.744 7.58a1.5 1.5 0 010-2.122l1.102-1.103m0 0a1.5 1.5 0 012.122 0l1.103 1.102m-1.103-1.102l-1.102 1.103m0 0a1.5 1.5 0 010 2.122l1.102 1.103m4.354-4.354l-1.103 1.102m1.103-1.102l1.102 1.103m0 0a1.5 1.5 0 010 2.122l-1.102 1.103",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756-2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    },
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
    <div className="flex flex-col lg:flex-row bg-white dark:bg-[#111b21] w-full h-full relative overflow-hidden">
      {/* Left Nav Rail — 64px icon-only on desktop, hidden on mobile */}
      <div className="hidden lg:flex w-[64px] bg-slate-50 dark:bg-[#111b21] flex-col items-center py-6 gap-2 flex-shrink-0 border-r border-slate-200 dark:border-[#202c33] relative z-10">
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
        />
      </div>

      <div className="flex-1 flex flex-col bg-white dark:bg-[#111b21] overflow-hidden border-r border-slate-100 dark:border-transparent">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Messages</h2>
            <button onClick={() => setActiveTab("contacts")} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#202c33] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
              </svg>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#202c33] text-sm font-medium text-slate-700 dark:text-[#e9edef] placeholder:text-slate-400 dark:placeholder:text-[#8696a0] border border-slate-200 dark:border-transparent focus:bg-white dark:focus:bg-[#2a3942] focus:ring-2 focus:ring-blue-500 dark:focus:ring-emerald-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearch(e.target.value.length > 0)
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          {showSearch && searchQuery ? (
            <div className="flex flex-col">
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
            <div className="flex flex-col">
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
        <div className="h-[64px] lg:hidden w-full flex-shrink-0"></div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 h-[64px] bg-white dark:bg-[#111b21] border-t border-slate-200 dark:border-[#202c33] flex items-center justify-around px-4 z-[60] shadow-[0_-4px_20px_rgba(0,0,0,0.02)] dark:shadow-none">
        {navItems.map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center w-16 h-full gap-1 transition-all ${activeTab === item.id ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
          >
            <svg className={`w-6 h-6 ${activeTab === item.id ? "scale-110" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === item.id ? "2.5" : "2"} d={item.icon}></path>
            </svg>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
        <button onClick={handleLogout} className="flex flex-col items-center justify-center w-16 h-full gap-1 text-slate-400 hover:text-red-500 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          <span className="text-[10px] font-bold">Logout</span>
        </button>
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
