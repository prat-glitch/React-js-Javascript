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
      <div className="flex-1 flex items-center justify-center">
        Select a chat
      </div>
    )
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-white">

      {/* HEADER */}
      <div className="h-[80px] flex items-center px-4 border-b flex-shrink-0">
        <h2 className="font-bold">{selectedChatUser.username}</h2>
      </div>

      {/* 🔥 IMPORTANT FIX */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col gap-3">

        {messages.map((msg, i) => {
          const isOwn = msg.senderId === userdata.uid
          return (
            <div key={i} className={isOwn ? 'text-right' : 'text-left'}>
              <div className={`inline-block px-4 py-2 rounded ${
                isOwn ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}>
                {msg.text}
              </div>
            </div>
          )
        })}

        {typingIndicator && <div>Typing...</div>}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="px-4 pt-3 pb-6 flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1 border px-3 py-2 rounded"
            placeholder="Type message..."
          />

          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 rounded"
          >
            Send
          </button>
        </div>
      </div>

    </div>
  )
}

export default Chatbox