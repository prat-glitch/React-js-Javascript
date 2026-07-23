import React from "react"
import assets from "../../assets/assets"

const UserCard = ({ user, lastMsg, isSelected, onClick, isOnline, unread }) => (
  <div 
    className={`
      flex items-center gap-4 py-3 px-4 mx-2 cursor-pointer rounded-xl transition-all duration-200 group
      ${isSelected ? "bg-blue-50 dark:bg-[#2a3942] text-blue-600 dark:text-[#e9edef]" : "hover:bg-slate-50 dark:hover:bg-[#202c33]"}
    `}
    onClick={onClick}
  >
    <div className="relative flex-shrink-0">
      <img src={user.avatar || assets.avatar_icon} className="w-14 h-14 rounded-full object-cover" alt={user.username} />
      {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#111b21]"></span>}
    </div>
    
    <div className="flex-1 min-w-0">

      {/* Row 1 — name + timestamp */}
      <div className="flex items-center justify-between mb-1">
        <h4 className={`text-sm font-semibold truncate ${isSelected ? "text-blue-900 dark:text-[#e9edef]" : "text-slate-800 dark:text-[#e9edef]"}`}>
          {user.username}
        </h4>
        <span className="text-[11px] text-slate-400 dark:text-[#8696a0] ml-1 flex-shrink-0">
          {user.updatedAt ? new Date(user.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null}
        </span>
      </div>

      {/* Row 2 — last message + unread badge */}
      <div className="flex items-center justify-between">
        <p className={`text-xs truncate flex-1 ${isSelected ? "text-blue-600 dark:text-[#e9edef] font-medium" : unread > 0 ? "text-slate-800 dark:text-[#e9edef] font-medium" : "text-slate-500 dark:text-[#8696a0]"}`}>
          {lastMsg || (isOnline ? "Active now" : "New connection")}
        </p>
        {unread > 0 && (
          <span className="ml-2 px-2 min-w-[1.25rem] h-5 bg-blue-600 dark:bg-emerald-500 text-white dark:text-[#111b21] text-[11px] flex items-center justify-center rounded-full font-bold flex-shrink-0">
            {unread}
          </span>
        )}
      </div>

    </div>
  </div>
)

export default UserCard