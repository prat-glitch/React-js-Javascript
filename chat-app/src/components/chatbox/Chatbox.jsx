import React, { useState, useEffect, useContext, useRef } from 'react'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { useSocket } from '../../context/SocketContext'
import { db } from '../../config/firebase'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore'
import { supabase } from '../../config/supabase'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) return
    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    if (currentChatIdRef.current && currentChatIdRef.current !== chatId) {
      if (isTypingRef.current) {
        stopTyping(currentChatIdRef.current)
        isTypingRef.current = false
      }
      leaveChat(currentChatIdRef.current)
    }
    setTypingIndicator(false)
    joinChat(chatId)
    currentChatIdRef.current = chatId
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (isTypingRef.current && currentChatIdRef.current) {
        stopTyping(currentChatIdRef.current)
        isTypingRef.current = false
      }
      if (currentChatIdRef.current) leaveChat(currentChatIdRef.current)
    }
  }, [userdata?.uid, selectedChatUser?.uid, getChatId, joinChat, leaveChat, stopTyping])

  useEffect(() => {
    if (!socket || !selectedChatUser?.uid) return
    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    const handleNewMessage = (data) => {
      if (data.chatId === chatId) {
        setMessages((prev) => [...prev, data.message])
        markAsRead(chatId, data.message.createdAt)
      }
    }
    const handleTypingUpdate = (data) => {
      if (data.chatId === chatId && data.userId !== userdata.uid) {
        setTypingIndicator(data.isTyping)
      }
    }
    socket.on('message:new', handleNewMessage)
    socket.on('typing:update', handleTypingUpdate)
    return () => {
      socket.off('message:new', handleNewMessage)
      socket.off('typing:update', handleTypingUpdate)
    }
  }, [socket, selectedChatUser?.uid, userdata?.uid, getChatId, markAsRead])

  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) {
      setMessages([])
      return
    }
    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    const chatRef = doc(db, 'chats', chatId)
    const unsub = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setMessages(data.messages || [])
      } else {
        setMessages([])
      }
    })
    return () => unsub()
  }, [userdata?.uid, selectedChatUser?.uid, getChatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingIndicator])

  const sendMessage = async () => {
    if (!input.trim() || !selectedChatUser || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    isTypingRef.current = false
    stopTyping(getChatId(userdata.uid, selectedChatUser.uid))
    try {
      const chatId = getChatId(userdata.uid, selectedChatUser.uid)
      if (isConnected && socketSendMessage(chatId, selectedChatUser.uid, text)) {
      } else {
        const chatRef = doc(db, 'chats', chatId)
        const chatSnap = await getDoc(chatRef)
        const newMessage = { senderId: userdata.uid, text, createdAt: Date.now() }
        if (chatSnap.exists()) {
          await updateDoc(chatRef, { messages: arrayUnion(newMessage) })
        } else {
          await setDoc(chatRef, { messages: [newMessage] })
        }
        await updateUserChats(userdata.uid, selectedChatUser.uid, text, false)
        await updateUserChats(selectedChatUser.uid, userdata.uid, text, true)
      }
    } catch (error) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const updateUserChats = async (ownerId, recipientId, lastMsg, isRecipient = false) => {
    const userChatsRef = doc(db, 'userChats', ownerId)
    const snap = await getDoc(userChatsRef)
    if (snap.exists()) {
      const data = snap.data()
      let chatdata = data.chatdata || []
      const existingChat = chatdata.find(c => c.recipientId === recipientId)
      const currentUnread = existingChat?.unread || 0
      chatdata = chatdata.filter(c => c.recipientId !== recipientId)
      chatdata.push({ recipientId, lastMsg, updatedAt: Date.now(), unread: isRecipient ? currentUnread + 1 : 0 })
      await updateDoc(userChatsRef, { chatdata })
    } else {
      await setDoc(userChatsRef, { chatdata: [{ recipientId, lastMsg, updatedAt: Date.now(), unread: isRecipient ? 1 : 0 }] })
    }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedChatUser) return
    setSending(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${userdata.uid}_${Date.now()}.${fileExt}`
      const filePath = `chat_images/${fileName}`
      const { error } = await supabase.storage.from('avatars').upload(filePath, file, { cacheControl: '3600', upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const imageUrl = urlData.publicUrl
      const chatId = getChatId(userdata.uid, selectedChatUser.uid)
      const chatRef = doc(db, 'chats', chatId)
      const chatSnap = await getDoc(chatRef)
      const newMessage = { senderId: userdata.uid, image: imageUrl, createdAt: Date.now() }
      if (chatSnap.exists()) { await updateDoc(chatRef, { messages: arrayUnion(newMessage) }) }
      else { await setDoc(chatRef, { messages: [newMessage] }) }
      await updateUserChats(userdata.uid, selectedChatUser.uid, 'Image', false)
      await updateUserChats(selectedChatUser.uid, userdata.uid, 'Image', true)
    } catch (error) { toast.error('Failed to send image') }
    finally { setSending(false); e.target.value = '' }
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    setInput(value)
    if (!selectedChatUser?.uid || !userdata?.uid) return
    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (value.trim()) {
      if (!isTypingRef.current) { isTypingRef.current = true; startTyping(chatId) }
      typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false; stopTyping(chatId) }, 1000)
    } else { isTypingRef.current = false; stopTyping(chatId) }
  }

  if (!selectedChatUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white lg:min-w-[600px] xl:min-w-[700px]">
        <div className="w-28 h-28 mb-8 relative flex items-center justify-center group">
          <div className="absolute inset-0 bg-[#f8f9fc] rounded-[2.5rem] transform rotate-12 transition-transform duration-500 group-hover:rotate-45"></div>
          <div className="absolute inset-0 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_20px_40px_rgba(37,99,235,0.3)] transform -rotate-6 transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110">
            <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <h2 className="text-[2rem] font-extrabold text-slate-800 tracking-tight leading-tight mb-1">Welcome to your</h2>
        <h2 className="text-[2.5rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-6">Fluid Exchange</h2>
        <p className="text-slate-500 max-w-sm leading-[1.8] text-[15px] font-medium">
          Select a conversation from the sidebar to begin messaging. Your encrypted high-end messaging experience starts here.
        </p>

        <div className="mt-16 flex flex-col items-center opacity-60 pointer-events-none select-none">
           <div className="w-8 h-8 rounded-full border-4 border-[#f4f6fa] flex items-center justify-center mb-[-8px] bg-white z-10 text-blue-500"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg></div>
           <div className="bg-gradient-to-b from-[#f4f6fa] to-transparent w-px h-32"></div>
           <div className="font-bold uppercase tracking-[0.3em] text-[10px] text-slate-300 mt-4 leading-relaxed text-center">End-To-End Encrypted<br/>FluidChat Premium V2.4</div>
        </div>
      </div>
    )
  }

  const online = isUserOnline(selectedChatUser.uid) || selectedChatUser.online;

  // Add formatting for last seen dynamically
  const formatLastSeen = (lastseen) => {
    if (!lastseen) return '';
    try {
      const lastSeenDate = new Date(lastseen);
      const now = new Date();
      const diffInHours = (now - lastSeenDate) / (1000 * 60 * 60);

      // If it's very recent or they are strictly online
      if (online) return 'ONLINE';

      // Within past 24 hours just show hours ago, else show the full standard date/time parsed string
      if (diffInHours < 24 && diffInHours > 1) {
        return `Last seen ${Math.floor(diffInHours)} hours ago`;
      } else if (diffInHours <= 1) {
        const diffInMins = (now - lastSeenDate) / (1000 * 60);
        if (diffInMins < 1) return 'Last seen just now';
        return `Last seen ${Math.floor(diffInMins)} minutes ago`;
      }
      return `Last seen ${lastseen}`;
    } catch {
      return `Last seen ${lastseen}`;
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative lg:min-w-[600px] xl:min-w-[700px]">
      {/* ── Chat Header ── */}
      <div className="h-[90px] px-8 border-b border-[#f4f6fa] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileView('sidebar')} className="md:hidden p-2 text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          
          <div className="relative">
            <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-[52px] h-[52px] rounded-[18px] object-cover shadow-sm bg-slate-50" alt="" />
            {online && <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></span>}
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{selectedChatUser.username}</h3>
              {online && <span className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">NOW</span>}
            </div>
            <div className="text-slate-500 text-sm font-semibold mt-0.5">
              {typingIndicator ? 'Typing...' : online ? <span className="text-emerald-500">ONLINE</span> : formatLastSeen(selectedChatUser.lastseen)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => initiateCall(selectedChatUser.uid, getChatId(userdata.uid, selectedChatUser.uid), 'audio')} className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          </button>
          <button onClick={() => initiateCall(selectedChatUser.uid, getChatId(userdata.uid, selectedChatUser.uid), 'video')} className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
          </button>
        </div>
      </div>

      {/* ── Messages Grid ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col gap-6">
        <div className="flex justify-center mb-4">
           <span className="px-4 py-1.5 bg-[#f8f9fc] text-[10px] font-extrabold text-slate-400 uppercase tracking-widest rounded-full">Today</span>
        </div>
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === userdata.uid
          return (
            <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full`}>
              <div className={`flex max-w-[85%] sm:max-w-[75%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
                {!isOwn && (
                  <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-8 h-8 rounded-full mb-1 flex-shrink-0" alt="" />
                )}
                
                <div className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  {msg.text && (
                    <div className={`px-6 py-4 rounded-[2rem] text-[15px] leading-relaxed shadow-sm ${
                      isOwn 
                        ? 'bg-blue-600 text-white rounded-br-[4px]' 
                        : 'bg-[#f4f6fa] text-slate-700 rounded-bl-[4px]'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  {msg.image && (
                    <div className="relative overflow-hidden rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.1)] border-[4px] border-white">
                      <img className="max-w-full lg:max-w-[360px] object-cover" src={msg.image} alt="" />
                    </div>
                  )}
                  
                  <span className={`text-[10px] text-slate-400 font-bold mt-1.5 uppercase ${isOwn ? 'pr-2' : 'pl-2'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isOwn && <span className="ml-1 text-blue-500">✓</span>}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {typingIndicator && (
          <div className="flex justify-start w-full">
            <div className="flex items-end gap-3">
              <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-8 h-8 rounded-full mb-1 flex-shrink-0" alt="" />
              <div className="bg-[#f4f6fa] px-5 py-4 rounded-[2rem] rounded-bl-[4px] flex gap-1.5 items-center w-fit shadow-sm">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input Area ── */}
      <div className="px-4 pb-6 sm:px-8 sm:pb-8 flex-shrink-0">
        <div className="flex items-end gap-3">
          
          <div className="flex-1 bg-[#f4f6fa] p-2 pl-4 rounded-[2rem] flex items-center transition-all border border-transparent focus-within:border-slate-200 focus-within:bg-white focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.03)] h-[60px]">
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700 transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </button>
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={input}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              disabled={sending}
              className="flex-1 bg-transparent px-4 border-none outline-none text-[15px] font-medium text-slate-800 placeholder:text-slate-400 h-full"
            />
          </div>

          <div className="flex items-center gap-2 h-[60px] pb-0">
            <input type="file" id="image" accept="image/png,image/jpeg" hidden onChange={handleImageUpload} />
            <label htmlFor="image" className="w-12 h-12 rounded-full border border-slate-100 bg-white flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-100 cursor-pointer transition-all shadow-sm">
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5V19M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </label>
            
            <button 
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-[0_4px_15px_rgba(37,99,235,0.4)] hover:bg-blue-700 disabled:bg-slate-200 disabled:shadow-none transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                 <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          
        </div>
      </div>
    </div>
  )
}

export default Chatbox