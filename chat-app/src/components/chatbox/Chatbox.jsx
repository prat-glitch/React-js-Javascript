import React, { useState, useEffect, useContext, useRef } from 'react'
import './chatbox.css'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { useSocket } from '../../context/SocketContext'
import { db } from '../../config/firebase'
import { doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore'
import { supabase } from '../../config/supabase'
import { toast } from 'react-toastify'

const Chatbox = () => {
  const { userdata, selectedChatUser, getChatId } = useContext(Appcontext)
  const { 
    socket, 
    isConnected, 
    joinChat, 
    leaveChat, 
    sendMessage: socketSendMessage, 
    startTyping, 
    stopTyping, 
    isUserOnline,
    getTypingUsers,
    markAsRead 
  } = useSocket()
  
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingIndicator, setTypingIndicator] = useState(false)
  const messagesEndRef = useRef(null)
  const currentChatIdRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Join/Leave Socket.IO chat room when selectedChatUser changes
  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) return

    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    
    // Leave previous room if any
    if (currentChatIdRef.current && currentChatIdRef.current !== chatId) {
      leaveChat(currentChatIdRef.current)
    }
    
    // Join new room
    joinChat(chatId)
    currentChatIdRef.current = chatId

    return () => {
      if (currentChatIdRef.current) {
        leaveChat(currentChatIdRef.current)
      }
    }
  }, [userdata?.uid, selectedChatUser?.uid, getChatId, joinChat, leaveChat])

  // Listen for Socket.IO message events
  useEffect(() => {
    if (!socket || !selectedChatUser?.uid) return

    const chatId = getChatId(userdata.uid, selectedChatUser.uid)

    const handleNewMessage = (data) => {
      if (data.chatId === chatId) {
        setMessages((prev) => [...prev, data.message])
        // Mark message as read
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

  // Fallback: Listen to messages via Firebase (for when Socket.IO is disconnected)
  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) {
      setMessages([])
      return
    }

    const chatId = getChatId(userdata.uid, selectedChatUser.uid)
    const chatRef = doc(db, 'chats', chatId)

    // Firebase listener as fallback/initial load
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

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Send text message
  const sendMessage = async () => {
    if (!input.trim() || !selectedChatUser || sending) return

    const text = input.trim()
    setInput('')
    setSending(true)
    stopTyping(getChatId(userdata.uid, selectedChatUser.uid))

    try {
      const chatId = getChatId(userdata.uid, selectedChatUser.uid)

      // Try Socket.IO first (real-time)
      if (isConnected && socketSendMessage(chatId, selectedChatUser.uid, text)) {
        console.log('Message sent via Socket.IO')
      } else {
        // Fallback to direct Firebase
        console.log('Socket.IO unavailable, using Firebase directly')
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

        // Update userChats for both users
        await updateUserChats(userdata.uid, selectedChatUser.uid, text, false)
        await updateUserChats(selectedChatUser.uid, userdata.uid, text, true)
      }

    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Update userChats collection
  const updateUserChats = async (ownerId, recipientId, lastMsg, isRecipient = false) => {
    const userChatsRef = doc(db, 'userChats', ownerId)
    const snap = await getDoc(userChatsRef)

    if (snap.exists()) {
      const data = snap.data()
      let chatdata = data.chatdata || []
      
      // Find existing entry
      const existingChat = chatdata.find(c => c.recipientId === recipientId)
      const currentUnread = existingChat?.unread || 0
      
      // Remove existing entry for this recipient
      chatdata = chatdata.filter(c => c.recipientId !== recipientId)
      
      // Add updated entry (increment unread for recipient)
      chatdata.push({
        recipientId,
        lastMsg,
        updatedAt: Date.now(),
        unread: isRecipient ? currentUnread + 1 : 0
      })

      await updateDoc(userChatsRef, { chatdata })
    } else {
      await setDoc(userChatsRef, {
        chatdata: [{
          recipientId,
          lastMsg,
          updatedAt: Date.now(),
          unread: isRecipient ? 1 : 0
        }]
      })
    }
  }

  // Send image
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedChatUser) return

    setSending(true)
    try {
      // Upload to Supabase
      const fileExt = file.name.split('.').pop()
      const fileName = `${userdata.uid}_${Date.now()}.${fileExt}`
      const filePath = `chat_images/${fileName}`

      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const imageUrl = urlData.publicUrl

      // Send as message
      const chatId = getChatId(userdata.uid, selectedChatUser.uid)
      const chatRef = doc(db, 'chats', chatId)
      const chatSnap = await getDoc(chatRef)

      const newMessage = {
        senderId: userdata.uid,
        image: imageUrl,
        createdAt: Date.now()
      }

      if (chatSnap.exists()) {
        await updateDoc(chatRef, { messages: arrayUnion(newMessage) })
      } else {
        await setDoc(chatRef, { messages: [newMessage] })
      }

      await updateUserChats(userdata.uid, selectedChatUser.uid, '📷 Image', false)
      await updateUserChats(selectedChatUser.uid, userdata.uid, '📷 Image', true)

    } catch (error) {
      console.error('Error uploading image:', error)
      toast.error('Failed to send image')
    } finally {
      setSending(false)
      e.target.value = ''
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    setInput(e.target.value)
    if (e.target.value && selectedChatUser?.uid) {
      startTyping(getChatId(userdata.uid, selectedChatUser.uid))
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // No chat selected
  if (!selectedChatUser) {
    return (
      <div className="chatbox">
        <div className="no-chat">
          <img src={assets.logo_icon} alt="Logo" />
          <p>Select a chat to start messaging</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chatbox">
      {/* Chat User Header */}
      <div className="chat-user">
        <img src={selectedChatUser.avatar || assets.avatar_icon} alt="Profile" />
        <div className="chat-user-info">
          <p className="chat-user-name">
            {selectedChatUser.username}
            {isUserOnline(selectedChatUser.uid) && <img className="dot" src={assets.green_dot} alt="Online" />}
          </p>
          <span className={`chat-user-status ${isUserOnline(selectedChatUser.uid) ? 'online' : 'offline'}`}>
            {isUserOnline(selectedChatUser.uid) 
              ? 'Online' 
              : selectedChatUser.lastseen 
                ? `Last seen: ${selectedChatUser.lastseen}` 
                : 'Offline'}
          </span>
        </div>
        <img src={assets.help_icon} className="help" alt="Help" />
        {!isConnected && <span className="socket-status offline">Disconnected</span>}
      </div>

      {/* Chat Messages */}
      <div className="chat-message">
        {messages.map((msg, index) => (
          <div key={index} className={msg.senderId === userdata.uid ? 's-msg' : 'r-msg'}>
            {msg.text && <p className="msg">{msg.text}</p>}
            {msg.image && <img className="msg-img" src={msg.image} alt="shared" />}
            <div className="msg-footer">
              <img 
                src={msg.senderId === userdata.uid ? (userdata.avatar || assets.avatar_icon) : (selectedChatUser.avatar || assets.avatar_icon)} 
                alt="avatar" 
              />
              <p className="time">{formatTime(msg.createdAt)}</p>
            </div>
          </div>
        ))}
        {typingIndicator && (
          <div className="typing-indicator">
            <span>{selectedChatUser.username} is typing</span>
            <span className="dots"><span>.</span><span>.</span><span>.</span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="chat-input">
        <input 
          type="text" 
          placeholder="Type a message..." 
          value={input}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          disabled={sending}
        />
        <input 
          type="file" 
          id="image" 
          accept="image/png,image/jpeg" 
          hidden 
          onChange={handleImageUpload}
        />
        <label htmlFor="image">
          <img src={assets.gallery_icon} alt="Gallery" />
        </label>
        <img 
          src={assets.send_button} 
          alt="Send" 
          onClick={sendMessage}
          style={{ cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1 }}
        />
      </div>
    </div>
  )
}

export default Chatbox
