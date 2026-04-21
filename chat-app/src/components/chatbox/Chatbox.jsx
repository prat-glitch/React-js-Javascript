import React, { useState, useEffect, useContext, useRef } from 'react'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { useSocket } from '../../context/SocketContext'
import { db } from '../../config/firebase'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore'
import { supabase } from '../../config/supabase'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import {Input} from "@/components/ui/input"

const Chatbox = ({ setMobileView }) => {
  const { userdata, selectedChatUser, getChatId } = useContext(Appcontext)
  const navigate = useNavigate()
  const { 
    socket, isConnected, joinChat, leaveChat, sendMessage: socketSendMessage, 
    startTyping, stopTyping, isUserOnline, markAsRead, initiateCall 
  } = useSocket()
  
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingIndicator, setTypingIndicator] = useState(false)

  const messagesEndRef = useRef(null)
  const currentChatIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)

  // ✅ FIXED scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingIndicator])

  // ================= CHAT =================

  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) return
    const chatId = getChatId(userdata.uid, selectedChatUser.uid)

    if (currentChatIdRef.current && currentChatIdRef.current !== chatId) {
      leaveChat(currentChatIdRef.current)
    }

    joinChat(chatId)
    currentChatIdRef.current = chatId

    return () => {
      if (currentChatIdRef.current) leaveChat(currentChatIdRef.current)
    }
  }, [userdata?.uid, selectedChatUser?.uid])

  useEffect(() => {
    if (!socket || !selectedChatUser?.uid) return
    const chatId = getChatId(userdata.uid, selectedChatUser.uid)

    socket.on('message:new', (data) => {
      if (data.chatId === chatId) {
        setMessages(prev => [...prev, data.message])
      }
    })

    socket.on('typing:update', (data) => {
      if (data.chatId === chatId && data.userId !== userdata.uid) {
        setTypingIndicator(data.isTyping)
      }
    })

    return () => {
      socket.off('message:new')
      socket.off('typing:update')
    }
  }, [socket, selectedChatUser])

  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) return

    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    const chatRef = doc(db, 'chats', chatId)

    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        setMessages(snap.data().messages || [])
      } else {
        setMessages([])
      }
    })

    return () => unsub()
  }, [userdata, selectedChatUser])

  // ================= SEND =================

  const sendMessage = async () => {
    if (!input.trim()) return

    const text = input.trim()
    setInput('')
    setSending(true)

    try {
      const chatId = getChatId(userdata.uid, selectedChatUser.uid)
      const chatRef = doc(db, 'chats', chatId)
      const chatSnap = await getDoc(chatRef)

      const newMessage = {
        senderId: userdata.uid,
        text,
        createdAt: Date.now()
      }

      if (chatSnap.exists()) {
        await updateDoc(chatRef, {
          messages: arrayUnion(newMessage)
        })
      } else {
        await setDoc(chatRef, {
          messages: [newMessage]
        })
      }

    } catch {
      toast.error('Failed to send message')
    }

    setSending(false)
  }

  // ================= UI =================

  if (!selectedChatUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
        <div className="w-28 h-28 mb-8 relative flex items-center justify-center group">
          <div className="absolute inset-0 bg-[#f8f9fc] rounded-[2.5rem] transform rotate-12 transition-transform duration-500 group-hover:rotate-45"></div>
          <div className="absolute inset-0 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_40px_rgba(37,99,235,0.3)] transform -rotate-6 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110">
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <h2 className="text-[2.5rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-4 tracking-tight leading-none">FluidChat</h2>
        <p className="text-slate-500 max-w-sm leading-[1.8] text-[15px] font-medium">Select a conversation from the sidebar to begin your premium messaging experience.</p>
      </div>
    )
  }

  const isOnline = selectedChatUser.online || false;

  return (
    <div className="flex-1 h-full flex flex-col bg-white relative">
      
      {/* ── HEADER ── */}
      <div className="h-[90px] px-6 md:px-8 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white/70 backdrop-blur-md z-10 shadow-sm relative">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileView('sidebar')} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          
          <div className="relative">
            <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-[52px] h-[52px] rounded-[18px] object-cover shadow-sm border border-slate-100" alt="" />
            {isOnline && <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></span>}
          </div>
          
          <div className="flex flex-col">
            <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{selectedChatUser.username}</h3>
            <div className="text-[13px] font-semibold mt-0.5">
              {typingIndicator ? (
                <span className="text-blue-500">Typing a message...</span>
              ) : isOnline ? (
                <span className="text-emerald-500 uppercase tracking-widest text-[10px]">Online Now</span>
              ) : (
                <span className="text-slate-400">
                  {selectedChatUser.lastseen ? `Last seen ${selectedChatUser.lastseen}` : 'Offline'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const chatId = getChatId(userdata.uid, selectedChatUser.uid)
              initiateCall(selectedChatUser.uid, chatId, 'audio')
              navigate(`/call/${chatId}?type=audio&role=caller`)
            }}
            className="w-11 h-11 rounded-[16px] bg-slate-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-all font-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          </button>
          <button 
            onClick={() => {
              const chatId = getChatId(userdata.uid, selectedChatUser.uid)
              initiateCall(selectedChatUser.uid, chatId, 'video')
              navigate(`/call/${chatId}?type=video&role=caller`)
            }}
            className="w-11 h-11 rounded-[16px] bg-slate-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all ml-1">
            <svg className="w-6 h-6 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
          </button>
        </div>
      </div>

      {/* ── MESSAGES LIST ── */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col gap-5 custom-scrollbar bg-slate-50/30">
        
        <div className="flex justify-center mb-2">
           <span className="px-4 py-1.5 bg-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-full shadow-inner">Today</span>
        </div>

        {messages.map((msg, i) => {
          const isOwn = msg.senderId === userdata.uid;
          const timeString = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          return (
            <div key={i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full group`}>
              <div className={`flex max-w-[85%] md:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2.5`}>
                
                {!isOwn && (
                  <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-8 h-8 rounded-[12px] mb-1 flex-shrink-0 shadow-sm border border-slate-100" alt="" />
                )}
                
                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-full overflow-hidden`}>
                  <div className={`relative px-3 pt-2 pb-6 md:px-4 md:pt-2 md:pb-6 text-[15px] leading-relaxed shadow-sm break-words whitespace-pre-wrap ${
                    isOwn 
                      ? 'bg-[#005c4b] text-white rounded-l-[18px] rounded-tr-[18px] rounded-br-[4px] shadow-md' 
                      : 'bg-white text-slate-800 rounded-r-[18px] rounded-tl-[18px] rounded-bl-[4px] border border-slate-100 shadow-sm'
                  }`}>
                    {msg.text}
                    <div className="absolute right-3 bottom-1.5 flex items-center gap-1 opacity-80">
                      <span className={`text-[10px] font-semibold ${isOwn ? 'text-white/80' : 'text-slate-400'}`}>{timeString}</span>
                      {isOwn && <svg className={`w-[14px] h-[14px] ${msg.readBy?.length > 1 ? 'text-[#53bdeb]' : 'text-white/60'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {typingIndicator && (
          <div className="flex justify-start w-full">
            <div className="flex items-end gap-2.5">
              <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-8 h-8 rounded-[12px] mb-1 flex-shrink-0 border border-slate-100" alt="" />
              <div className="bg-white border border-slate-100 px-5 py-4 w-[72px] h-[52px] rounded-[24px] rounded-bl-[6px] flex gap-1.5 items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.03)]">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* ── INPUT AREA ── */}
      <div className="px-5 pb-6 pt-2 bg-gradient-to-t from-white via-white to-transparent relative z-20">
        <div className="h-[68px] bg-[#f8f9fc] rounded-[2rem] flex items-center px-3 gap-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] border border-slate-100 focus-within:bg-white focus-within:shadow-[0_10px_40px_rgba(37,99,235,0.08)] focus-within:border-blue-100 transition-all duration-300">
          
          <button className="w-11 h-11 rounded-full flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all focus:outline-none flex-shrink-0 ml-1">
            <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </button>
          
          <button className="hidden sm:flex w-11 h-11 rounded-full items-center justify-center text-slate-400 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all focus:outline-none flex-shrink-0">
            <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={sending}
            placeholder="Type your message..."
            className="flex-1 bg-transparent px-3 flex-shrink min-w-0 border-none outline-none text-[15px] font-medium text-slate-700 placeholder:text-slate-400 h-full"
          />

          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-[1.5rem] flex items-center justify-center shadow-[0_4px_15px_rgba(37,99,235,0.4)] transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none flex-shrink-0 mr-1"
          >
            <svg className="w-5 h-5 ml-[2px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>

        </div>
      </div>

    </div>
  )
}

export default Chatbox