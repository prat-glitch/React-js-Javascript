import React from "react"
import assets from "../../assets/assets"

const UserCard = ({ user, lastMsg, isSelected, onClick, isOnline, unread }) => (
  <div 
    className={`
      flex items-center gap-5 py-4 px-5 mx-2 cursor-pointer rounded-[24px] transition-all duration-200 group
      ${isSelected ? "bg-blue-50 text-blue-600" : "hover:bg-[#f8f9fc]"}
    `}
    onClick={onClick}
  >
    <div className="relative flex-shrink-0">
      <img src={user.avatar || assets.avatar_icon} className="w-14 h-14 rounded-full object-cover" alt={user.username} />
      {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>}
    </div>
    
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <h4 className={`text-base font-bold truncate ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
          {user.username}
        </h4>
        {unread > 0 && <span className="px-2 min-w-[1.5rem] h-6 bg-blue-600 text-white text-[11px] flex items-center justify-center rounded-full font-bold">{unread}</span>}
      </div>
      <p className={`text-sm truncate ${isSelected ? "text-blue-600 font-medium" : "text-slate-500 font-medium"}`}>
        {lastMsg || (isOnline ? "Active now" : "New connection")}
      </p>
    </div>
  </div>
)

export default UserCard
