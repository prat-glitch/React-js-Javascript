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
  }, [messages])

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
      await updateUserChats(userdata.uid, selectedChatUser.uid, '≡ƒô╖ Image', false)
      await updateUserChats(selectedChatUser.uid, userdata.uid, '≡ƒô╖ Image', true)
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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
        <div className="w-24 h-24 mb-6 relative">
          <div className="absolute inset-0 bg-blue-100 rounded-[2rem] transform rotate-12 transition-transform hover:rotate-6"></div>
          <div className="absolute inset-0 bg-blue-500 rounded-[2rem] flex items-center justify-center shadow-lg transform -rotate-12 transition-transform hover:-rotate-6 hover:scale-105">
            <img src={assets.logo_icon} alt="Logo" className="w-12 h-12 brightness-[10]" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Welcome to your</h2>
        <h2 className="text-3xl font-extrabold text-blue-600 mb-6">Fluid Exchange</h2>
        <p className="text-slate-400 max-w-sm leading-relaxed text-sm">
          Select a conversation or start a new message to begin your high-fluidity communication journey.
        </p>
      </div>
    )
  }

  const online = isUserOnline(selectedChatUser.uid)

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* ΓöÇΓöÇ Chat Header ΓöÇΓöÇ */}
      <div className="h-[90px] px-8 border-b border-slate-50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileView('sidebar')} className="md:hidden p-2 text-slate-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          
          <div className="relative">
            <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-12 h-12 rounded-full object-cover shadow-sm" alt="" />
            {online && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white"></span>}
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{selectedChatUser.username}</h3>
            <div className={`status-pill ${online ? 'status-pill status-online' : 'status-pill status-offline'} mt-1`}>
              {typingIndicator ? 'Typing...' : online ? 'Active Now' : 'Offline'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => initiateCall(selectedChatUser.uid, getChatId(userdata.uid, selectedChatUser.uid), 'audio')} className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          </button>
          <button onClick={() => initiateCall(selectedChatUser.uid, getChatId(userdata.uid, selectedChatUser.uid), 'video')} className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button className="w-11 h-11 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </button>
        </div>
      </div>

      {/* ΓöÇΓöÇ Messages Grid ΓöÇΓöÇ */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
        {messages.map((msg, index) => {
          const isOwn = msg.senderId === userdata.uid
          return (
            <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-animate items-end gap-3`}>
              {!isOwn && <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-8 h-8 rounded-full mb-1" alt="" />}
              <div className={`max-w-[70%] group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                {msg.text && (
                  <div className={`px-5 py-3.5 rounded-[2rem] text-sm leading-relaxed shadow-sm ${
                    isOwn ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-50 text-slate-800 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                )}
                {msg.image && <img className="max-w-full rounded-2xl lg:max-w-[400px] shadow-md border-4 border-white mt-1" src={msg.image} alt="" />}
                <span className="text-[10px] text-slate-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        {typingIndicator && (
          <div className="flex justify-start items-center gap-3">
            <div className="bg-slate-50 px-4 py-3 rounded-full flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ΓöÇΓöÇ Chat Input ΓöÇΓöÇ */}
      <div className="p-8 flex-shrink-0">
        <div className="flex items-center gap-4 bg-slate-50 p-2 pl-6 rounded-[2.5rem] focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-slate-100">
          <input 
            type="text" 
            placeholder="Write your message..." 
            value={input}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={sending}
            className="flex-1 bg-transparent py-3 border-none outline-none text-[15px] text-slate-700 placeholder:text-slate-400"
          />
          
          <div className="flex items-center gap-2">
            <input type="file" id="image" accept="image/png,image/jpeg" hidden onChange={handleImageUpload} />
            <label htmlFor="image" className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-500 cursor-pointer transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </label>
            <button 
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
            >
              <svg className="w-6 h-6 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chatbox
