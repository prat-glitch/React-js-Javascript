import React, { useContext } from 'react'
import assets from '../../assets/assets'
import { logout } from '../../config/firebase'
import { Appcontext } from '../../context/Appcontext'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'

const Rightsidebar = () => {
  const { userdata, selectedChatUser } = useContext(Appcontext)
  const { isUserOnline } = useSocket()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // Use selected chat user if available, else show logged in user
  const displayUser = selectedChatUser || userdata
  const online = displayUser ? isUserOnline(displayUser.uid) : false

  if (!displayUser) return null

  return (
    <div className="h-full flex flex-col bg-white overflow-y-auto px-6 py-10">
      {/* ── User Card ── */}
      <div className="flex flex-col items-center text-center mb-10">
        <div className="relative mb-6">
          <div className="w-28 h-28 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl relative z-10">
            <img src={displayUser.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt="" />
          </div>
          {/* Decorative background circle */}
          <div className="absolute -inset-2 bg-blue-100/50 rounded-[3rem] blur-xl opacity-70 z-0"></div>
          {online && (
            <div className="absolute -bottom-1 -right-1 z-20 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="w-4 h-4 bg-emerald-500 rounded-full"></span>
            </div>
          )}
        </div>
        
        <h3 className="text-xl font-extrabold text-slate-800 mb-1">{displayUser.username}</h3>
        <div className={`status-pill ${online ? 'status-pill status-online' : 'status-pill status-offline'}`}>
          {online ? 'Active Now' : displayUser.lastseen ? `Last seen ${displayUser.lastseen}` : 'Offline'}
        </div>
        <p className="mt-4 text-sm text-slate-400 font-medium px-4 leading-relaxed">
          {displayUser.bio || "No bio available. Communication in progress."}
        </p>
      </div>

      {/* ── Information Cards ── */}
      <div className="flex flex-col gap-4 mb-10">
        <div className="fluid-card p-5 !rounded-3xl border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Account Details</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              </div>
              <span className="text-sm font-medium text-slate-600 truncate">{displayUser.email}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <span className="text-sm font-medium text-slate-600">Local Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        <div className="fluid-card p-5 !rounded-3xl border border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Fluidity Metadata</p>
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span>Security Status</span>
            <span className="text-blue-500 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L10 1.55l7.834 3.35a1 1 0 01.666.945V10c0 5.825-4.139 10.518-8.167 12.002a1 1 0 01-.666 0C5.639 20.518 1.5 15.825 1.5 10V5.845a1 1 0 01.666-.945zM10 5a1 1 0 011 1v2a1 1 0 11-2 0V6a1 1 0 011-1zm1 5a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd"></path></svg>
              Verified
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      {!selectedChatUser && (
        <div className="flex flex-col gap-3 mt-auto">
          <button 
            onClick={() => navigate('/profile')} 
            className="w-full py-4 bg-blue-600 text-white rounded-[2rem] font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
          >
            Edit Fluid Profile
          </button>
          <button 
            onClick={handleLogout} 
            className="w-full py-4 text-slate-400 font-bold text-sm hover:text-red-400 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Logout session
          </button>
        </div>
      )}

      {selectedChatUser && (
        <div className="mt-auto">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Shared Media</p>
          <div className="grid grid-cols-3 gap-2">
            {[assets.pic1, assets.pic2, assets.pic3, assets.pic4].map((pic, i) => (
              <div key={i} className="aspect-square bg-slate-50 rounded-2xl overflow-hidden hover:opacity-80 transition-opacity cursor-pointer">
                <img src={pic} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
            <div className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 hover:bg-slate-100 cursor-pointer">
              <span className="text-xl font-bold">+</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Rightsidebar