import React, { useContext, useState } from 'react'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { logout } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'

const Leftsidebar = ({ setMobileView }) => {
  const navigate = useNavigate()
  const { userdata, allUsers, userChats, selectedChatUser, setSelectedChatUser, unreadChats, markChatAsRead } = useContext(Appcontext)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const { isUserOnline } = useSocket()
  const [activeTab, setActiveTab] = useState('messages') // 'messages' | 'contacts' | 'settings'

  const handleSelectUser = (user) => {
    setSelectedChatUser(user)
    setSearchQuery('')
    setShowSearch(false)
    if (unreadChats[user.uid]) {
      markChatAsRead(user.uid)
    }
    if (setMobileView) setMobileView('chat')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Icons Column Data
  const navItems = [
    { id: 'messages', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'contacts', icon: 'M12 4.354l1.102 1.103a1.5 1.5 0 010 2.122l-1.102 1.103m-7.154 0L3.744 7.58a1.5 1.5 0 010-2.122l1.102-1.103m0 0a1.5 1.5 0 012.122 0l1.103 1.102m-1.103-1.102l-1.102 1.103m0 0a1.5 1.5 0 010 2.122l1.102 1.103m4.354-4.354l-1.103 1.102m1.103-1.102l1.102 1.103m0 0a1.5 1.5 0 010 2.122l-1.102 1.103' },
    { id: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ]

  // Filter users based on search
  const filteredUsers = allUsers.filter(u => 
    u.uid !== userdata?.uid && 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const recentChatUsers = userChats
    .map(chat => ({
      ...allUsers.find(u => u.uid === chat.recipientId),
      lastMsg: chat.lastMsg,
      updatedAt: chat.updatedAt,
      unread: chat.unread || 0
    }))
    .filter(u => u && u.uid)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex w-full h-full">
      {/* ΓöÇΓöÇ Nav Rail Column (Dark) ΓöÇΓöÇ */}
      <div className="w-[80px] bg-[#101c3d] flex flex-col items-center py-8 flex-shrink-0">
        <div className="mb-12">
          <img src={assets.logo_icon} className="w-8 h-8" alt="logo" />
        </div>
        
        <nav className="flex flex-col gap-6 flex-1">
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-rail-item text-white/40 hover:text-white ${activeTab === item.id ? 'active !text-white' : ''}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
              </svg>
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-6 mt-auto">
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 transition-all hover:border-white"
          >
            <img src={userdata?.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt="profile" />
          </button>
          <button onClick={handleLogout} className="text-white/40 hover:text-red-400 transition-colors">
            <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* ΓöÇΓöÇ User List Column (White) ΓöÇΓöÇ */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6 text-slate-800">Messages</h2>
          
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input 
              type="text" 
              placeholder="Search users..."
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearch(e.target.value.length > 0)
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {/* Search Results */}
          {showSearch && searchQuery && (
            <div className="flex flex-col gap-1">
              <p className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Search Results</p>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <UserCard key={user.uid} user={user} isSelected={selectedChatUser?.uid === user.uid} onClick={() => handleSelectUser(user)} isOnline={isUserOnline(user.uid)} />
                ))
              ) : (
                <p className="p-8 text-center text-slate-400 text-sm">No users found for "{searchQuery}"</p>
              )}
            </div>
          )}

          {/* Recent Chats */}
          {!showSearch && (
            <div className="flex flex-col gap-1">
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
                <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path>
                    </svg>
                  </div>
                  <p className="text-slate-400 text-sm">No messages yet. Start a conversation!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const UserCard = ({ user, lastMsg, isSelected, onClick, isOnline, unread }) => (
  <div 
    className={`
      flex items-center gap-4 p-4 cursor-pointer rounded-3xl transition-all duration-300 group
      ${isSelected ? 'bg-blue-600 shadow-[0_10px_20px_rgba(37,99,235,0.2)]' : 'hover:bg-slate-50'}
    `}
    onClick={onClick}
  >
    <div className="relative flex-shrink-0">
      <img src={user.avatar || assets.avatar_icon} className="w-14 h-14 rounded-full object-cover shadow-sm" alt={user.username} />
      {isOnline && <span className="absolute bottom-0 right-1.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></span>}
    </div>
    
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <h4 className={`text-[15px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
          {user.username}
        </h4>
        {unread > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">{unread}</span>}
      </div>
      <p className={`text-xs truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
        {lastMsg || (isOnline ? 'Active now' : 'Away')}
      </p>
    </div>
  </div>
)

export default Leftsidebar
