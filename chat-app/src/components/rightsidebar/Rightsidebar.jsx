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
    /* Slide-in panel — sits on top of the right sidebar column */
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s ease',
        overflowY: 'auto',
      }}
    >
      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 20px',
        borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
        position: 'sticky', top: 0, background: '#fff', zIndex: 10,
      }}>
        <button
          onClick={() => setShowContactInfo(false)}
          style={{
            width: 34, height: 34, borderRadius: '50%',
            border: 'none', background: '#f1f5f9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#475569', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
          onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
          Contact info
        </span>
      </div>

      {/* ── Avatar section ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '32px 24px 24px',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <img
            src={selectedChatUser.avatar || assets.avatar_icon}
            alt=""
            style={{
              width: 96, height: 96, borderRadius: '50%', objectFit: 'cover',
              border: '3px solid #fff',
              boxShadow: '0 4px 24px rgba(15,23,42,0.12)',
            }}
          />
          {isOnline && (
            <span style={{
              position: 'absolute', bottom: 4, right: 4,
              width: 14, height: 14, background: '#10b981',
              borderRadius: '50%', border: '2.5px solid white',
            }} />
          )}
        </div>

        {/* Name */}
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: 0, textAlign: 'center' }}>
          {selectedChatUser.username}
        </h2>

        {/* Email */}
        <p style={{ fontSize: 13, color: '#2563eb', fontWeight: 500, margin: '6px 0 0', textAlign: 'center' }}>
          {selectedChatUser.email}
        </p>

        {/* Online / last seen */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          {isOnline ? (
            <>
              <span style={{ width: 7, height: 7, background: '#10b981', borderRadius: '50%' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>Online</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
              {selectedChatUser.lastseen ? `Last seen ${selectedChatUser.lastseen}` : 'Offline'}
            </span>
          )}
        </div>
      </div>

      {/* ── About / Bio ── */}
      <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
          About
        </p>
        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
          {selectedChatUser.bio || 'Hey there! I am using FluidChat.'}
        </p>
      </div>

      {/* ── Media, links and docs ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Gallery icon */}
            <svg width="18" height="18" fill="none" stroke="#475569" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
              Media, links and docs
            </span>
          </div>
          {sharedMedia.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>
              {sharedMedia.length}
            </span>
          )}
        </div>

        {/* Media grid */}
        {mediaLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#94a3b8" strokeWidth="4"/>
              <path className="opacity-75" fill="#94a3b8" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          </div>
        ) : sharedMedia.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 20 }}>
            {sharedMedia.map((m, i) => (
              <div
                key={i}
                onClick={() => window.open(m.media_url, '_blank')}
                style={{
                  aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
                  cursor: 'pointer', background: '#f1f5f9',
                }}
              >
                <img
                  src={m.media_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                />
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '24px 0 20px', textAlign: 'center',
          }}>
            <div style={{ width: 44, height: 44, background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <svg width="20" height="20" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', margin: 0 }}>No media shared yet</p>
            <p style={{ fontSize: 11, color: '#cbd5e1', margin: '4px 0 0' }}>Photos sent in this chat appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Rightsidebar