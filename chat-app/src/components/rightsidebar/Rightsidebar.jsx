import React, { useContext, useState, useEffect } from 'react'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { getSupabase } from '../../config/supabase'

const Rightsidebar = ({ showContactInfo, setShowContactInfo }) => {
  const { userdata, selectedChatUser, getChatId } = useContext(Appcontext)

  const [sharedMedia, setSharedMedia] = useState([])
  const [mediaLoading, setMediaLoading] = useState(false)

  /* ── fetch real shared images when contact panel opens ── */
  useEffect(() => {
    if (!showContactInfo || !selectedChatUser || !userdata) return

    const fetchMedia = async () => {
      setMediaLoading(true)
      try {
        const chatId = getChatId(userdata.uid, selectedChatUser.uid)
        const { data } = await getSupabase()
          .from('messages')
          .select('media_url, media_type, created_at')
          .eq('chat_id', chatId)
          .eq('media_type', 'image')
          .order('created_at', { ascending: false })
          .limit(9)
        setSharedMedia(data || [])
      } catch { setSharedMedia([]) }
      finally { setMediaLoading(false) }
    }

    fetchMedia()
  }, [showContactInfo, selectedChatUser?.uid])

  /* ── nothing to show if panel is closed or no user ── */
  if (!showContactInfo || !selectedChatUser) return null

  const isOnline = selectedChatUser.online || false

  return (
    <div
      className="absolute inset-0 z-[100] flex flex-col overflow-y-auto bg-white dark:bg-[#111b21]"
      style={{ animation: 'slideInRight 0.22s ease' }}
    >
      {/* ── Header bar ── */}
      <div className="flex items-center gap-3.5 px-4 py-4 md:px-5 md:py-[18px] border-b border-slate-100 dark:border-white/5 flex-shrink-0 sticky top-0 z-10 bg-white dark:bg-[#111b21]">
        <button
          onClick={() => setShowContactInfo(false)}
          className="w-11 h-11 md:w-[34px] md:h-[34px] min-w-0 rounded-full border-none bg-slate-100 dark:bg-[#2a3942] flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 flex-shrink-0 hover:bg-slate-200 dark:hover:bg-[#3b4a54] active:scale-95 transition-all"
        >
          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="text-[17px] md:text-[15px] font-bold text-slate-900 dark:text-slate-100">
          Contact info
        </span>
      </div>

      {/* ── Avatar section ── */}
      <div className="flex flex-col items-center px-6 pt-8 pb-6 border-b border-slate-100 dark:border-white/5">
        <div className="relative mb-4">
          <img
            src={selectedChatUser.avatar || assets.avatar_icon}
            alt=""
            className="w-24 h-24 rounded-full object-cover border-[3px] border-white dark:border-[#202c33] shadow-[0_4px_24px_rgba(15,23,42,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
          />
          {isOnline && (
            <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[2.5px] border-white dark:border-[#111b21]" />
          )}
        </div>

        <h2 className="text-[22px] md:text-[19px] font-extrabold text-slate-900 dark:text-slate-100 m-0 text-center">
          {selectedChatUser.username}
        </h2>

        <p className="text-[14px] md:text-[13px] text-blue-600 dark:text-emerald-400 font-medium mt-1.5 mb-0 text-center">
          {selectedChatUser.email}
        </p>

        <div className="flex items-center gap-1.5 mt-2">
          {isOnline ? (
            <>
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[13px] md:text-[12px] font-semibold text-emerald-500">Online</span>
            </>
          ) : (
            <span className="text-[13px] md:text-[12px] text-slate-400 dark:text-slate-500 font-medium">
              {selectedChatUser.lastseen ? `Last seen ${selectedChatUser.lastseen}` : 'Offline'}
            </span>
          )}
        </div>
      </div>

      {/* ── About / Bio ── */}
      <div className="px-5 pt-5 border-b border-slate-100 dark:border-white/5">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-[0.08em] uppercase m-0 mb-2.5">
          About
        </p>
        <p className="text-[15px] md:text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed m-0 mb-5">
          {selectedChatUser.bio || 'Hey there! I am using FluidChat.'}
        </p>
      </div>

      {/* ── Media, links and docs ── */}
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <svg className="w-[18px] h-[18px] text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span className="text-[15px] md:text-[14px] font-bold text-slate-800 dark:text-slate-100">
              Media, links and docs
            </span>
          </div>
          {sharedMedia.length > 0 && (
            <span className="text-[13px] font-bold text-blue-600 dark:text-emerald-400">
              {sharedMedia.length}
            </span>
          )}
        </div>

        {mediaLoading ? (
          <div className="flex justify-center py-6">
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75 fill-slate-400" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : sharedMedia.length > 0 ? (
          <div className="grid grid-cols-3 gap-1 mb-5">
            {sharedMedia.map((m, i) => (
              <div
                key={i}
                onClick={() => window.open(m.media_url, '_blank')}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-slate-100 dark:bg-[#2a3942]"
              >
                <img
                  src={m.media_url}
                  alt=""
                  className="w-full h-full object-cover block transition-opacity duration-150 hover:opacity-80"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-11 h-11 bg-slate-50 dark:bg-[#2a3942] rounded-full flex items-center justify-center mb-2.5">
              <svg className="w-5 h-5 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-slate-400 dark:text-slate-500 m-0">No media shared yet</p>
            <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1 mb-0">Photos sent in this chat appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Rightsidebar
