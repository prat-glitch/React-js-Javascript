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

  const navItems = [
    { id: 'messages', label: 'Chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'contacts', label: 'Contacts', icon: 'M12 4.354l1.102 1.103a1.5 1.5 0 010 2.122l-1.102 1.103m-7.154 0L3.744 7.58a1.5 1.5 0 010-2.122l1.102-1.103m0 0a1.5 1.5 0 012.122 0l1.103 1.102m-1.103-1.102l-1.102 1.103m0 0a1.5 1.5 0 010 2.122l1.102 1.103m4.354-4.354l-1.103 1.102m1.103-1.102l1.102 1.103m0 0a1.5 1.5 0 010 2.122l-1.102 1.103' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ]

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
    <div className="flex w-full h-full relative">
      <div className="w-20 lg:w-[240px] bg-[#f8f9fc] flex flex-col py-8 px-4 flex-shrink-0 border-r border-slate-200 z-20">
        <div className="mb-10 flex flex-col lg:flex-row items-center lg:items-start gap-4 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="hidden lg:block">
            <h1 className="font-extrabold text-slate-800 text-xl leading-none tracking-tight">FluidChat</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Premium Messaging</p>
          </div>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ${activeTab === item.id ? 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-blue-600' : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'}`}
            >
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path>
              </svg>
              <span className="hidden lg:block font-bold text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-2 mt-auto">
          <button className="flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-500 hover:bg-white/50 hover:text-slate-800 transition-all">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden lg:block font-bold text-sm">Help</span>
          </button>
          <button onClick={handleLogout} className="flex items-center gap-4 px-4 py-3 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all group">
            <svg className="w-6 h-6 flex-shrink-0 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
            </svg>
            <span className="hidden lg:block font-bold text-sm">Logout</span>
          </button>
          
          <button 
            onClick={() => navigate('/profile')}
            className="mt-4 flex items-center gap-3 px-2 hidden lg:flex"
          >
            <img src={userdata?.avatar || assets.avatar_icon} className="w-10 h-10 rounded-full object-cover shadow-sm border-2 border-white" alt="profile" />
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800 leading-tight">{userdata?.username}</p>
            </div>
          </button>
          
          <button 
            onClick={() => navigate('/profile')}
            className="mt-4 w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm mx-auto lg:hidden"
          >
            <img src={userdata?.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt="profile" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div className="pt-8 px-6 pb-4">
          <div className="relative group mb-6">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
               <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
               </svg>
            </div>
            <input 
              type="text" 
              placeholder="Search conversations..."
              className="w-full pl-12 pr-4 py-3.5 bg-[#f8f9fc] border-none rounded-2xl text-[15px] font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 focus:bg-white outline-none transition-all placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSearch(e.target.value.length > 0)
              }}
            />
          </div>
          <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.2em]">Recent Chats</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          {showSearch && searchQuery && (
             <div className="flex flex-col gap-1">
               {filteredUsers.length > 0 ? (
                 filteredUsers.map((user) => (
                   <UserCard key={user.uid} user={user} isSelected={selectedChatUser?.uid === user.uid} onClick={() => handleSelectUser(user)} isOnline={isUserOnline(user.uid)} />
                 ))
               ) : (
                 <p className="p-8 text-center text-slate-400 text-sm">No users found</p>
               )}
             </div>
          )}

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
                   <div className="w-16 h-16 bg-[#f8f9fc] rounded-3xl flex items-center justify-center mx-auto mb-4">
                     <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path>
                     </svg>
                   </div>
                   <p className="text-slate-400 text-sm font-medium">No messages yet.</p>
                 </div>
               )}
             </div>
          )}
        </div>
      </div>
      
      {activeTab === 'settings' && (
        <div className="absolute top-0 left-20 lg:left-[240px] right-[-100vw] bottom-0 z-50 bg-[#060814] text-white overflow-y-auto flex pl-0 w-[100vw] lg:w-[calc(100vw-240px)] lg:right-auto max-w-[1400px]">
          <div className="w-full flex flex-col p-8 lg:p-14 max-w-6xl">
            <div className="flex items-center gap-8 mb-16">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-pink-500 to-orange-400 p-1">
                 <img src={userdata?.avatar || assets.avatar_icon} alt="" className="w-full h-full rounded-[22px] object-cover border-2 border-transparent" />
                </div>
                <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center border-2 border-[#060814]">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                </button>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-blue-500 mb-2 tracking-tight">{userdata?.username}</h1>
                <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  Active now
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-3xl p-2">
                  <div className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl flex items-center justify-between group text-slate-800">
                    <div className="flex items-center gap-4">
                       <span className="font-bold text-sm">Account</span>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100 mx-4"></div>
                  <div className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl flex items-center justify-between group text-slate-800">
                    <div className="flex items-center gap-4">
                       <span className="font-bold text-sm">Privacy & Security</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-3xl p-2">
                  <div className="p-4 hover:bg-slate-50 cursor-pointer rounded-2xl flex items-center justify-between group text-slate-800">
                    <div className="flex items-center gap-4">
                       <span className="font-bold text-sm">Notifications</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-6">
                <div className="bg-[#1d4ed8] rounded-3xl p-8 text-white relative overflow-hidden">
                  <h3 className="text-xl font-bold mb-2 relative z-10">Pro Member</h3>
                  <button className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold text-sm hover:shadow-lg transition-all relative z-10">Manage Subscription</button>
                </div>
                
                <div className="bg-white text-slate-800 rounded-3xl p-6">
                  <h3 className="font-bold text-sm mb-4">Support</h3>
                  <button className="block text-slate-500 mb-2">Help Center</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="absolute top-0 left-20 lg:left-[240px] right-[-100vw] bottom-0 z-50 bg-[#060814] text-white overflow-y-auto flex pl-0 w-[100vw] lg:w-[calc(100vw-240px)] lg:right-auto max-w-[1400px]">
          <div className="w-full flex flex-col p-8 lg:p-14 max-w-6xl">
            <div className="flex flex-col lg:flex-row justify-between lg:items-end mb-16 gap-6">
              <div>
                <h1 className="text-4xl lg:text-[56px] font-black text-blue-600 tracking-tight lg:leading-[1.1] mb-2">Directory</h1>
                <p className="text-slate-400 font-medium text-sm ml-1">{allUsers.length} active connections</p>
              </div>
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2.5 w-fit transition-all shadow-[0_10px_25px_rgba(37,99,235,0.3)]">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                New Contact
              </button>
            </div>
            
            <div className="flex flex-col gap-12 lg:gap-16">
              {['A', 'B', 'C'].map((letter, letterIdx) => {
                const groupUsers = allUsers.filter((u, idx) => (idx % 3) === letterIdx) 
                if (groupUsers.length === 0 && letter !== 'A') return null;
                return (
                  <div key={letter} className="relative pl-10 border-l-2 border-[#1a1f36]">
                    <div className="absolute left-[-17px] top-4 w-8 h-8 rounded-full bg-[#060814] border-2 border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{letter}</div>
                    
                    <div className="flex flex-wrap gap-5">
                       {groupUsers.map((u, i) => (
                          <div 
                            key={i} 
                            onClick={() => handleSelectUser(u)} 
                            className="bg-white text-slate-800 rounded-[28px] p-2.5 pr-8 flex items-center gap-4 group cursor-pointer hover:-translate-y-1 transition-all h-[90px] min-w-[280px] shadow-sm hover:shadow-xl"
                          >
                             <div className="w-[70px] h-[70px] rounded-[22px] overflow-hidden bg-slate-100 flex-shrink-0 shadow-inner">
                               <img src={u.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt=""/>
                             </div>
                             <div className="flex flex-col justify-center">
                               <h4 className="font-extrabold text-[15px] leading-tight text-slate-800 group-hover:text-blue-600 transition-colors">{u.username}</h4>
                               <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{u.email?.split('@')[0] || 'Member'}</p>
                             </div>
                             <div className="ml-auto opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                                 <button className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                 </button>
                             </div>
                          </div>
                       ))}
                       {letter === 'A' && (
                         <div className="bg-[#0b0e1e] text-slate-400 border border-slate-800 border-dashed rounded-[28px] p-2.5 flex items-center gap-4 h-[90px] min-w-[280px] cursor-pointer hover:bg-[#12172d] transition-all group">
                             <div className="w-[70px] h-[70px] rounded-[22px] bg-[#1a1f36] flex items-center justify-center flex-shrink-0 group-hover:bg-[#202742] transition-colors">
                               <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                             </div>
                             <div className="font-bold text-sm tracking-wide">Add to '{letter}' Group</div>
                         </div>
                       )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const UserCard = ({ user, lastMsg, isSelected, onClick, isOnline, unread }) => (
  <div 
    className={`
      flex items-center gap-4 py-3 px-4 mx-2 cursor-pointer rounded-[20px] transition-all duration-200 group
      ${isSelected ? 'bg-blue-50 text-blue-600' : 'hover:bg-[#f8f9fc]'}
    `}
    onClick={onClick}
  >
    <div className="relative flex-shrink-0">
      <img src={user.avatar || assets.avatar_icon} className="w-12 h-12 rounded-full object-cover" alt={user.username} />
      {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>}
    </div>
    
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
          {user.username}
        </h4>
        {unread > 0 && <span className="px-1.5 min-w-[1.25rem] h-5 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full font-bold">{unread}</span>}
      </div>
      <p className={`text-xs truncate ${isSelected ? 'text-blue-600 font-medium' : 'text-slate-500 font-medium'}`}>
        {lastMsg || (isOnline ? 'Active now' : 'New connection')}
      </p>
    </div>
  </div>
)

export default Leftsidebar