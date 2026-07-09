import React from "react"
import assets from "../../assets/assets"

const UserCard = ({ user, lastMsg, isSelected, onClick, isOnline, unread }) => (
  <div 
    className={`
      flex items-center gap-4 py-3 px-4 mx-2 cursor-pointer rounded-xl transition-all duration-200 group
      ${isSelected ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50"}
    `}
    onClick={onClick}
  >
    <div className="relative flex-shrink-0">
      <img src={user.avatar || assets.avatar_icon} className="w-14 h-14 rounded-full object-cover" alt={user.username} />
      {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>}
    </div>
    
    <div className="flex-1 min-w-0">

      {/* Row 1 — name + timestamp */}
      <div className="flex items-center justify-between mb-1">
        <h4 className={`text-sm font-semibold truncate ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
          {user.username}
        </h4>
        <span className="text-[11px] text-slate-400 ml-1 flex-shrink-0">
          {user.updatedAt ? new Date(user.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null}
        </span>
      </div>

      {/* Row 2 — last message + unread badge */}
      <div className="flex items-center justify-between">
        <p className={`text-xs truncate flex-1 ${isSelected ? "text-blue-600 font-medium" : unread > 0 ? "text-slate-800 font-medium" : "text-slate-500"}`}>
          {lastMsg || (isOnline ? "Active now" : "New connection")}
        </p>
        {unread > 0 && (
          <span className="ml-2 px-2 min-w-[1.25rem] h-5 bg-blue-600 text-white text-[11px] flex items-center justify-center rounded-full font-bold flex-shrink-0">
            {unread}
          </span>
        )}
      </div>

    </div>
  </div>
)

export default UserCard