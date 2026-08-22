import React, { useContext, useState, useEffect } from "react"
import assets from "../../assets/assets"
import { Appcontext } from "../../context/Appcontext"
import { decryptMessage, parseEncryptedPayload } from "../../lib/crypto"

const UserCard = ({ user, lastMsg, isSelected, onClick, isOnline, unread }) => {
  const { userdata } = useContext(Appcontext)
  const [displayText, setDisplayText] = useState(lastMsg)

  useEffect(() => {
    let active = true

    const decryptLastMsg = async () => {
      const payload = parseEncryptedPayload(lastMsg)
      if (!payload) {
        if (active) setDisplayText(lastMsg)
        return
      }

      const otherPublicKey = user?.public_key
      if (!otherPublicKey || !userdata?.uid) {
        if (active) setDisplayText('[Encrypted message]')
        return
      }

      try {
        const plaintext = await decryptMessage(
          payload.ciphertext,
          payload.iv,
          otherPublicKey,
          userdata.uid
        )
        if (active) setDisplayText(plaintext)
      } catch (err) {
        console.error('[UserCard] Decryption failed:', err)
        if (active) setDisplayText('[Encrypted message]')
      }
    }

    decryptLastMsg()

    return () => {
      active = false
    }
  }, [lastMsg, user?.public_key, userdata?.uid])

  return (
    <div 
      className={`
        flex items-center gap-4 p-3.5 md:p-4 cursor-pointer rounded-2xl transition-all duration-200 border-l-4 active:scale-[0.99]
        ${isSelected ? "bg-blue-50 dark:bg-[#273647]/40 dark:border-[#b4c5ff] border-blue-500" : "hover:bg-slate-50 dark:hover:bg-[#273647]/20 border-transparent dark:border-transparent"}
      `}
      onClick={onClick}
    >
      <div className="relative flex-shrink-0">
        <div className="w-[58px] h-[58px] md:w-14 md:h-14 rounded-2xl overflow-hidden bg-slate-100 dark:bg-[#0d1c2d]">
          <img src={user.avatar || assets.avatar_icon} className="w-full h-full object-cover" alt={user.username} />
        </div>
        {isOnline && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#4ade80] rounded-full shadow-[0_0_0_2px_#ffffff] dark:shadow-[0_0_0_2px_#122131]"></span>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        {/* Row 1 — name + timestamp */}
        <div className="flex items-baseline justify-between mb-0.5">
          <span className={`text-[17px] md:text-[16px] font-bold truncate ${isSelected ? "text-blue-900 dark:text-[#d4e4fa]" : "text-slate-800 dark:text-[#d4e4fa]"}`}>
            {user.username}
          </span>
          <span className="text-[12px] font-medium text-slate-400 dark:text-[#c3c6d7] ml-2 flex-shrink-0">
            {user.updatedAt ? new Date(user.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null}
          </span>
        </div>

        {/* Row 2 — last message + unread badge */}
        <div className="flex items-center justify-between">
          <p className={`text-[15px] md:text-[14px] truncate flex-1 ${isSelected ? "text-blue-600 dark:text-[#b4c5ff] font-medium" : unread > 0 ? "text-slate-800 dark:text-[#d4e4fa] font-medium" : "text-slate-500 dark:text-[#c3c6d7]"}`}>
            {displayText || (isOnline ? "Active now" : "New connection")}
          </p>
          {unread > 0 && (
            <span className="ml-2 px-2 min-w-[1.25rem] h-5 bg-blue-600 dark:bg-[#b4c5ff] text-white dark:text-[#00174b] text-[11px] flex items-center justify-center rounded-lg font-bold flex-shrink-0">
              {unread}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserCard