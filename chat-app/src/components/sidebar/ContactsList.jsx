import React, { useContext, useRef, useState, useEffect, useMemo } from "react"
import assets from "../../assets/assets"
import { useNavigate } from "react-router-dom"
import { Appcontext } from "../../context/Appcontext"
import { getSupabase, supabase as publicSupabase } from "../../config/supabase"
import { toast } from "react-toastify"

/* ─── Add Contact Modal ─────────────────────────────────────────
   Rendered as a portal-like fixed overlay so it is ALWAYS
   centred on the full viewport — never clipped by the sidebar.
────────────────────────────────────────────────────────────────*/
const AddContactModal = ({ onClose, onStartChat }) => {
  const overlayRef = useRef(null)
  const inputRef   = useRef(null)

  const [query,     setQuery]     = useState("")
  const [searching, setSearching] = useState(false)
  const [result,    setResult]    = useState(null)
  const [notFound,  setNotFound]  = useState(false)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    const q = query.trim().toLowerCase()
    if (!q) return
    setSearching(true); setResult(null); setNotFound(false)
    try {
      const isEmail = q.includes("@")
      const { data } = await getSupabase()
        .from("users").select("*")
        .eq(isEmail ? "email" : "phone", q)
        .maybeSingle()
      data ? setResult(data) : setNotFound(true)
    } catch { toast.error("Search failed") }
    finally { setSearching(false) }
  }

  return (
    /* Fixed viewport overlay — always full-screen, never clipped */
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)",
        padding: "16px",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20,
          width: "100%", maxWidth: 440,
          boxShadow: "0 24px 80px rgba(15,23,42,0.22)",
          overflow: "hidden",
          animation: "slideUp 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0 }}>Add New Contact</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>Search by email or phone number</p>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#64748b" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} style={{ padding: "20px 24px" }}>
          {/* Input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#f8fafc", border: "1.5px solid #e2e8f0",
            borderRadius: 12, padding: "0 14px", height: 48, width: "100%", boxSizing: "border-box",
          }}>
            <svg width="17" height="17" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setResult(null); setNotFound(false) }}
              placeholder="name@email.com or phone number"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#1e293b", fontWeight: 500, minWidth: 0 }}
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); setResult(null); setNotFound(false) }}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0, flexShrink: 0 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Full-width search button */}
          <button
            type="submit"
            disabled={searching || !query.trim()}
            style={{
              width: "100%", height: 46, marginTop: 10, borderRadius: 12,
              border: "none", cursor: (searching || !query.trim()) ? "not-allowed" : "pointer",
              background: (searching || !query.trim()) ? "#eff6ff" : "#2563eb",
              color: (searching || !query.trim()) ? "#93c5fd" : "#fff",
              fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, boxSizing: "border-box",
            }}
          >
            {searching ? (
              <>
                <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Searching…
              </>
            ) : (
              "Search Contact"
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ height: 1, background: "#f1f5f9", margin: "0 24px" }} />

        {/* Result */}
        <div style={{ padding: "20px 24px" }}>
          {result && (
            <div style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "#f0f9ff", border: "1.5px solid #bae6fd",
              borderRadius: 14, padding: "14px 16px",
            }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={result.avatar || assets.avatar_icon} alt=""
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
                {result.online && <span style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11, background: "#10b981", borderRadius: "50%", border: "2px solid white" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.username}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.email}</p>
              </div>
              <button
                onClick={() => { onStartChat(result); onClose() }}
                style={{ flexShrink: 0, padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
                onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
              >
                Message
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          )}

          {notFound && !searching && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", textAlign: "center" }}>
              <div style={{ width: 48, height: 48, background: "#fef2f2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <svg width="22" height="22" fill="none" stroke="#f87171" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", margin: 0 }}>No user found</p>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Double-check the email or phone and try again</p>
            </div>
          )}

          {!result && !notFound && !searching && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, background: "#f1f5f9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <svg width="20" height="20" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, margin: 0 }}>Find someone to chat with</p>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>Enter their email or phone number above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ContactsList — the overlay panel inside the sidebar column
═══════════════════════════════════════════════════════════════ */
const ContactsList = ({ activeTab, allUsers, userdata, handleSelectUser }) => {
  const navigate      = useNavigate()
  const { loaduserdata } = useContext(Appcontext)
  const fileInputRef  = useRef(null)

  const [uploading,    setUploading]    = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery,  setSearchQuery]  = useState("")

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file || !userdata) return
    try {
      setUploading(true)
      const ext      = file.name.split(".").pop()
      const filePath = `avatars/${userdata.uid}_${Date.now()}.${ext}`
      const { error } = await getSupabase().storage.from("avatars").upload(filePath, file, { cacheControl: "3600", upsert: true })
      if (error) { toast.error("Upload failed"); return }
      const { data: urlData } = publicSupabase.storage.from("avatars").getPublicUrl(filePath)
      await getSupabase().from("users").update({ avatar: urlData.publicUrl }).eq("uid", userdata.uid)
      if (loaduserdata) await loaduserdata(userdata.uid)
      toast.success("Avatar updated!")
    } catch { toast.error("Something went wrong") }
    finally { setUploading(false) }
  }

  const filteredUsers = useMemo(() => {
    const others = allUsers.filter(u => u.uid !== userdata?.uid)
    if (!searchQuery.trim()) return others
    const q = searchQuery.toLowerCase()
    return others.filter(u => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [allUsers, userdata, searchQuery])

  const groupedContacts = useMemo(() => {
    const groups = {}
    filteredUsers.forEach(u => {
      const letter = (u.username?.[0] || "#").toUpperCase()
      if (!groups[letter]) groups[letter] = []
      groups[letter].push(u)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredUsers])

  if (activeTab !== "contacts" && activeTab !== "settings") return null

  /* ─── panel base style ─── */
  const panelBase = "absolute top-0 left-0 lg:left-[64px] right-0 bottom-0 z-50 bg-white dark:bg-[#111b21] flex flex-col overflow-x-hidden"

  /* ════════════════ SETTINGS ════════════════ */
  if (activeTab === "settings") {
    return (
      <>
        {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onStartChat={handleSelectUser} />}
        <div className={panelBase} style={{ overflowY: "auto", paddingBottom: 64 }}>
          <div style={{ padding: "24px 20px", maxWidth: 560, width: "100%" }}>

            {/* Profile row */}
            <div className="flex items-center gap-4 pb-6 mb-5 border-b border-slate-100 dark:border-[#202c33]">
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={userdata?.avatar || assets.avatar_icon} alt=""
                  className="w-16 h-16 rounded-full object-cover border-[3px] border-slate-100 dark:border-[#202c33]" style={{ opacity: uploading ? 0.5 : 1 }} />
                <button disabled={uploading} onClick={() => fileInputRef.current?.click()}
                  style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, background: "#2563eb", borderRadius: "50%", border: "2.5px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="11" height="11" fill="none" stroke="white" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
                <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept=".png,.jpg,.jpeg" style={{ display: "none" }} />
              </div>
              <div>
                <p className="text-[16px] font-bold text-slate-900 dark:text-slate-100 m-0">{userdata?.username}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <span style={{ width: 7, height: 7, background: "#10b981", borderRadius: "50%" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#10b981" }}>Online</span>
                </div>
              </div>
            </div>

            {/* Settings list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Account Settings", sub: "Edit profile, name and bio", iconPath: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", iconColor: "#2563eb", iconBg: "#eff6ff", onClick: () => navigate("/profile") },
                { label: "Privacy & Security", sub: "Manage your privacy settings", iconPath: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", iconColor: "#7c3aed", iconBg: "#f5f3ff", onClick: null },
                { label: "Notifications", sub: "Alerts and sound settings", iconPath: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", iconColor: "#d97706", iconBg: "#fffbeb", onClick: null },
                { label: "Help & Support", sub: "FAQ and contact", iconPath: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", iconColor: "#059669", iconBg: "#f0fdf4", onClick: null },
              ].map(({ label, sub, iconPath, iconColor, iconBg, onClick }) => (
                <button key={label} onClick={onClick || undefined}
                  className="flex items-center gap-[14px] p-[12px_14px] bg-white dark:bg-[#111b21] border-[1.5px] border-slate-100 dark:border-transparent rounded-[14px] w-full text-left transition-colors hover:bg-slate-50 dark:hover:bg-[#202c33]"
                  style={{ cursor: onClick ? "pointer" : "default" }}
                >
                  <div style={{ width: 38, height: 38, background: iconBg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="17" height="17" fill="none" stroke={iconColor} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={iconPath}/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-[13px] font-bold text-slate-800 dark:text-slate-200 m-0">{label}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-[2px] mb-0">{sub}</p>
                  </div>
                  <svg width="15" height="15" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    )
  }

  /* ════════════════ CONTACTS ════════════════ */
  return (
    <>
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onStartChat={handleSelectUser} />}

      <div className={panelBase}>

        {/* ── Header — safe on all widths ── */}
        <div style={{ padding: "20px 16px 0", flexShrink: 0 }}>

          {/* Title row: always single line, button never clips */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100 m-0 tracking-[-0.02em]">
                Contacts
              </h2>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-[2px] mb-0">
                {filteredUsers.length} {filteredUsers.length === 1 ? "person" : "people"}
              </p>
            </div>

            {/* Pill button — icon + text on medium+, icon only on tight widths */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 14px",
                background: "#2563eb", color: "#fff",
                border: "none", borderRadius: 999,
                fontSize: 12, fontWeight: 700,
                cursor: "pointer", flexShrink: 0,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
              onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
              </svg>
              <span>New</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#202c33] border-[1.5px] border-slate-200 dark:border-transparent rounded-[10px] px-[12px] h-[38px] mb-[16px] w-full box-border">
            <svg width="14" height="14" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search contacts…"
              className="flex-1 border-none outline-none bg-transparent text-[13px] font-medium min-w-0 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0, flexShrink: 0 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Contact list ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 12px 80px" }} className="custom-scrollbar">

          {/* Empty state */}
          {filteredUsers.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" }}>
              <div className="w-[52px] h-[52px] bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-[14px]">
                <svg width="24" height="24" fill="none" stroke="#94a3b8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </div>
              <p className="text-[14px] font-bold m-0 text-slate-600 dark:text-slate-300">
                {searchQuery ? "No matches" : "No contacts yet"}
              </p>
              <p className="text-[12px] mt-[6px] mb-0 max-w-[180px] text-slate-400 dark:text-slate-500">
                {searchQuery ? "Try a different name or email" : "Find people by email or phone"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, padding: "10px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1d4ed8"}
                  onMouseLeave={e => e.currentTarget.style.background = "#2563eb"}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/>
                  </svg>
                  Add first contact
                </button>
              )}
            </div>
          )}

          {/* A→Z groups */}
          {groupedContacts.map(([letter, users]) => (
            <div key={letter} style={{ marginBottom: 20 }}>
              {/* Letter divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginBottom: 6 }}>
                <span className="text-[10px] font-bold tracking-[0.1em] text-slate-400 dark:text-slate-500">{letter}</span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-[#202c33]" />
              </div>

              {/* User rows */}
              {users.map((u) => (
                <div
                  key={u.uid}
                  onClick={() => handleSelectUser(u)}
                  className="flex items-center gap-3 p-[9px_8px] rounded-[12px] cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-[#202c33]"
                >
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img src={u.avatar || assets.avatar_icon} alt=""
                      style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                    {u.online && (
                      <span style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10, background: "#10b981", borderRadius: "50%", border: "2px solid white" }} />
                    )}
                  </div>

                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-[13px] font-bold m-0 overflow-hidden text-ellipsis whitespace-nowrap text-slate-900 dark:text-slate-100">
                      {u.username}
                    </p>
                    <p className="text-[11px] mt-[2px] mb-0 overflow-hidden text-ellipsis whitespace-nowrap text-slate-400 dark:text-slate-500">
                      {u.email?.split("@")[0]}
                    </p>
                  </div>

                  {/* Status */}
                  {u.online ? (
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#10b981", background: "#f0fdf4", padding: "3px 8px", borderRadius: 999, border: "1px solid #bbf7d0" }}>
                      Online
                    </span>
                  ) : (
                    <div style={{ flexShrink: 0, width: 30, height: 30, background: "#eff6ff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="13" height="13" fill="#2563eb" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default ContactsList
