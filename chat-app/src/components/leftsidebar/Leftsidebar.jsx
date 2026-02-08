import React, { useContext, useState } from 'react'
import './leftsidebar.css'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { logout } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'
const Leftsidebar = () => {
  const navigate = useNavigate()
  const { userdata, allUsers, userChats, selectedChatUser, setSelectedChatUser, unreadChats, markChatAsRead } = useContext(Appcontext)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const { isUserOnline, isConnected } = useSocket()
  // Filter users based on search
  const filteredUsers = allUsers.filter(u => 
    u.uid !== userdata?.uid && 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get user data by ID
  const getUserById = (uid) => allUsers.find(u => u.uid === uid)

  // Get users with recent chats (sorted by last message time)
  const recentChatUsers = userChats
    .map(chat => ({
      ...getUserById(chat.recipientId),
      lastMsg: chat.lastMsg,
      updatedAt: chat.updatedAt,
      unread: chat.unread || 0
    }))
    .filter(u => u && u.uid)

  // Get users without recent chats
  const otherUsers = allUsers.filter(u => 
    u.uid !== userdata?.uid && 
    !userChats.some(chat => chat.recipientId === u.uid)
  )

  // Handle user selection (start new chat or open existing)
  const handleSelectUser = (user) => {
    setSelectedChatUser(user)
    setSearchQuery('')
    setShowSearch(false)
    // Mark chat as read when selected
    if (unreadChats[user.uid]) {
      markChatAsRead(user.uid)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className='ls'>
      <div className='ls-top'>
        <div className='ls-nav'>
          <img src={assets.logo} className='logo' alt=''/>
          {/* <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Live' : '○ Offline'}
          </span> */}
          <div className='menu'>
            <img src={assets.menu_icon} alt='' />
            <div className="submenu">
              <p onClick={() => navigate('/profile')}>Edit Profile</p>
              <hr />
              <p onClick={handleLogout}>Logout</p>
            </div>
          </div>
        </div>
        <div className='ls-search'>
          <img src={assets.search_icon} alt=''/>
          <input 
            type='text' 
            placeholder='Search users...'
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearch(e.target.value.length > 0)
            }}
          />
        </div>
      </div>

      <div className='ls-list'>
        {/* Search Results */}
        {showSearch && searchQuery && (
          <>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div 
                  key={user.uid} 
                  className={`friends ${selectedChatUser?.uid === user.uid ? 'active' : ''}`}
                  onClick={() => handleSelectUser(user)}
                >
                  <img src={user.avatar || assets.avatar_icon} alt=''/>
                  {isUserOnline(user.uid) && <span className="online-dot"></span>}
                  <div>
                    <p>{user.username}</p>
                    <span>{isUserOnline(user.uid) ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-results">No users found</p>
            )}
          </>
        )}

        {/* Recent Chats (with last message) */}
        {!showSearch && recentChatUsers.length > 0 && (
          <>
            {recentChatUsers.map((user) => (
              <div 
                key={user.uid} 
                className={`friends ${selectedChatUser?.uid === user.uid ? 'active' : ''} ${user.unread > 0 ? 'has-unread' : ''}`}
                onClick={() => handleSelectUser(user)}
              >
                <img src={user.avatar || assets.avatar_icon} alt=''/>
                {isUserOnline(user.uid) && <span className="online-dot"></span>}
                {user.unread > 0 && <span className="unread-badge">{user.unread}</span>}
                <div>
                  <p>{user.username}</p>
                  <span className={user.unread > 0 ? 'unread-msg' : ''}>{user.lastMsg}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Other Users (no chat history) */}
        {!showSearch && otherUsers.length > 0 && (
          <>
            {recentChatUsers.length > 0 && <div className="separator">Other Users</div>}
            {otherUsers.map((user) => (
              <div 
                key={user.uid} 
                className={`friends ${selectedChatUser?.uid === user.uid ? 'active' : ''}`}
                onClick={() => handleSelectUser(user)}
              >
                <img src={user.avatar || assets.avatar_icon} alt=''/>
                {isUserOnline(user.uid) && <span className="online-dot"></span>}
                <div>
                  <p>{user.username}</p>
                  <span>{isUserOnline(user.uid) ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {!showSearch && recentChatUsers.length === 0 && otherUsers.length === 0 && (
          <p className="no-results">No other users yet</p>
        )}
      </div>
    </div>
  )
}

export default Leftsidebar