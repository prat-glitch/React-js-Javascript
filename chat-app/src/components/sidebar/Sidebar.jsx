import React, { useContext, useState } from "react"
import assets from "../../assets/assets"
import { Appcontext } from "../../context/Appcontext"
import { logout } from "../../config/firebase"
import { useNavigate } from "react-router-dom"
import { useSocket } from "../../context/SocketContext"
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
  } = useContext(Appcontext)

  const [searchQuery, setSearchQuery] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const { isUserOnline } = useSocket()
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

  const recentChatUsers = userChats
    .map((chat) => ({
      ...allUsers.find((u) => u.uid === chat.recipientId),
      lastMsg: chat.lastMsg,
      updatedAt: chat.updatedAt,
      unread: chat.unread || 0,
    }))
    .filter((u) => u && u.uid)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex bg-[#f4f6fb] w-full h-full relative overflow-hidden">
      <div className="hidden lg:flex w-[220px] bg-[#eef2f7] flex-col p-6 flex-shrink-0 border-r border-slate-200/70">
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <img src={assets.logo_icon} className="w-5 h-5" alt="logo" />
            </div>
            <div>
              <h1 className="text-[15px] font-black text-slate-800 leading-tight">FluidChat</h1>
              <p className="text-[10px] font-semibold text-slate-400">Premium Messaging</p>
            </div>
          </div>
        </div>

        <NavigationMenu
          navItems={navItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleLogout={handleLogout}
        />
      </div>

      <div className="flex-1 flex flex-col bg-[#f1f3f8] overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-800">Messages</h2>
            <button className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
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
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white text-sm font-medium text-slate-700 placeholder:text-slate-400 shadow-sm"
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
                    isOnline={isUserOnline(user.uid)}
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
                  isOnline={isUserOnline(user.uid)}
                  unread={unreadChats[user.uid]}
                />
              ))}

              {recentChatUsers.length === 0 && (
                <div className="p-10 text-center text-slate-400 text-sm">Your inbox is empty</div>
              )}
            </div>
          )}
        </div>
      </div>

      <ContactsList
        activeTab={activeTab}
        allUsers={allUsers}
        userdata={userdata}
        handleSelectUser={handleSelectUser}
        isUserOnline={isUserOnline}
      />
    </div>
  )
}

export default Sidebar
