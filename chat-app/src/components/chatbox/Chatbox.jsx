import React, { useState, useEffect, useContext, useRef } from 'react'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { getSupabase } from '../../config/supabase'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import Audiocallbar from '../calls/Audiocallbar'

const Chatbox = ({ setMobileView }) => {
  const { userdata, selectedChatUser, getChatId } = useContext(Appcontext)
  const navigate = useNavigate()
  
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingIndicator, setTypingIndicator] = useState(false)

  const messagesEndRef = useRef(null)
  const currentChatIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)
  const channelRef = useRef(null)
  const fileinputref = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingIndicator])

  // ================= CHAT INITIALIZATION & REALTIME =================
  useEffect(() => {
    if (!userdata?.uid || !selectedChatUser?.uid) return;
    
    const chatId = getChatId(userdata.uid, selectedChatUser.uid);
    currentChatIdRef.current = chatId;

    const fetchMessages = async () => {
      const { data, error } = await getSupabase()
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setMessages(data);

        // Mark any unread messages from the other user as read
        const unreadMsgs = data.filter(m => m.sender_id !== userdata.uid && !m.read_by.includes(userdata.uid));
        if (unreadMsgs.length > 0) {
          const unreadIds = unreadMsgs.map(m => m.id);
          await getSupabase()
            .from('messages')
            .update({ read_by: [selectedChatUser.uid, userdata.uid] })
            .in('id', unreadIds);
        }
      }
    };

    fetchMessages();

    // Setup Supabase Realtime for this specific chat
    const channel = getSupabase().channel(`chat:${chatId}`);

    // Listen for new messages inserted into DB
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`
    }, async (payload) => {
      const newMessage = payload.new;
      setMessages(prev => [...prev, newMessage]);

      // If we received a message while the chat is open, mark it as read immediately
      if (newMessage.sender_id !== userdata.uid && !newMessage.read_by.includes(userdata.uid)) {
        await getSupabase()
          .from('messages')
          .update({ read_by: [selectedChatUser.uid, userdata.uid] })
          .eq('id', newMessage.id);
          
        await getSupabase()
          .from('user_chats')
          .update({ unread: 0 })
          .eq('owner_id', userdata.uid)
          .eq('recipient_id', selectedChatUser.uid);
      }
    });

    // Listen for message updates (e.g. read receipts)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`
    }, (payload) => {
      setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
    });

    // Listen for typing broadcasts
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload.userId !== userdata.uid) {
        setTypingIndicator(payload.payload.isTyping);
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [userdata?.uid, selectedChatUser?.uid]);

  // ================= TYPING INDICATORS =================
  const handleTyping = (e) => {
    setInput(e.target.value);
    
    if (channelRef.current) {
      if (!isTypingRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { userId: userdata.uid, isTyping: true }
        });
        isTypingRef.current = true;
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: userdata.uid, isTyping: false }
          });
          isTypingRef.current = false;
        }
      }, 2000);
    }
  };

  // ================= SENDING MESSAGES =================
  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const text = input.trim();
    setInput('');
    setSending(true);

    if (channelRef.current && isTypingRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: userdata.uid, isTyping: false }
      });
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    try {
      const chatId = currentChatIdRef.current;
      
      // The database trigger will automatically update user_chats for both users!
      const { error } = await getSupabase().from('messages').insert({
        chat_id: chatId,
        sender_id: userdata.uid,
        text: text,
        created_at: Date.now(),
        read_by: [userdata.uid]
      });

      if (error) throw error;
    } catch(err) {
      console.error("send error:", err);
      toast.error('Failed to send message');
    }

    setSending(false);
  };

  const handlemediaupload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileinputref.current) fileinputref.current.value = '';

    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      toast.error('File size exceeds 20MB limit');
      return;
    }

    setSending(true);

    try {
      const chatId = currentChatIdRef.current;
      const ext = file.name.split('.').pop();
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const storagepath = `${userdata.uid}/${chatId}/${filename}`;

      // Upload directly using authenticated Supabase client
      const supabase = getSupabase();
      const { error: uploaderror } = await supabase.storage.from('chat-media').upload(storagepath, file);
      if (uploaderror) throw uploaderror;

      const { data: signeddata } = await supabase.storage.from('chat-media').createSignedUrl(storagepath, 60 * 60 * 24 * 365);
      
      const isimage = file.type.startsWith('image/');
      
      const { error } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userdata.uid,
        text: '',
        media_url: signeddata.signedUrl,
        media_type: isimage ? 'image' : 'file',
        file_name: file.name,
        file_size: file.size,
        created_at: Date.now(),
        read_by: [userdata.uid]
      });

      if (error) throw error;
      toast.success('File sent');
    } catch(err) {
      console.error("Upload error:", err);
      toast.error('Failed to send file');
    }
    setSending(false);
  };

  // ================= UI =================
  if (!selectedChatUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
        <div className="w-20 h-20 mb-6 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-blue-100 rounded-full"></div>
          <div className="absolute inset-0 flex items-center justify-center text-blue-600">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">FluidChat</h2>
        <p className="text-slate-500 max-w-sm text-sm font-medium">Select a conversation from the sidebar to begin messaging.</p>
      </div>
    )
  }

  const isOnline = selectedChatUser.online || false;

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50 relative">
      
      {/* ── HEADER ── */}
      <div className="h-[80px] px-6 md:px-8 border-b border-slate-200 flex items-center justify-between flex-shrink-0 bg-white z-10 relative">
        <div className="flex items-center gap-4">
          <button onClick={() => setMobileView('sidebar')} className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          
          <div className="relative">
            <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-100" alt="" />
            {isOnline && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white"></span>}
          </div>
          
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-800 leading-tight truncate">{selectedChatUser.username}</h3>
            <div className="text-[12px] font-medium mt-0.5 flex items-center gap-2">
              {typingIndicator ? (
                <span className="text-blue-500">Typing...</span>
              ) : isOnline ? (
                <span className="text-emerald-500">Active now</span>
              ) : (
                <span className="text-slate-500 truncate">
                  {selectedChatUser.lastseen ? `Last seen ${selectedChatUser.lastseen}` : 'Offline'}
                </span>
              )}
            </div>
          </div>
          
          <div className="ml-2 md:ml-6 flex-shrink-0">
            <Audiocallbar />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              const chatId = getChatId(userdata.uid, selectedChatUser.uid);
              getSupabase().channel(`user:${selectedChatUser.uid}`).send({
                type: 'broadcast',
                event: 'call:incoming',
                payload: {
                  callerId: userdata.uid,
                  callerName: userdata.username,
                  chatId: chatId,
                  callType: 'audio'
                }
              });
              navigate(`/call/${chatId}?type=audio&role=caller`)
            }}
            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
          </button>
          <button 
            onClick={() => {
              const chatId = getChatId(userdata.uid, selectedChatUser.uid);
              getSupabase().channel(`user:${selectedChatUser.uid}`).send({
                type: 'broadcast',
                event: 'call:incoming',
                payload: {
                  callerId: userdata.uid,
                  callerName: userdata.username,
                  chatId: chatId,
                  callType: 'video'
                }
              });
              navigate(`/call/${chatId}?type=video&role=caller`)
            }}
            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all ml-1">
            <svg className="w-6 h-6 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
          </button>
        </div>
      </div>

      {/* ── MESSAGES LIST ── */}
      <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 flex flex-col gap-2 custom-scrollbar bg-slate-50">

        <div className="flex justify-center mb-4">
          <span className="bg-slate-200 text-slate-500 text-[10px] font-bold tracking-widest uppercase rounded-full px-3 py-1">
            Today
          </span>
        </div>

        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === userdata.uid;
          const timeString = new Date(Number(msg.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={msg.id || i} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} w-full group mb-1`}>
              <div className={`flex max-w-[80%] md:max-w-[65%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>

                {!isOwn && (
                  <img
                    src={selectedChatUser.avatar || assets.avatar_icon}
                    className="w-8 h-8 rounded-[12px] mb-1 flex-shrink-0 shadow-sm border border-white/10"
                    alt=""
                  />
                )}

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-full`}>
                  <div
                    style={{ padding: msg.media_url ? '4px' : '8px 14px' }}
                    className={`relative text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
                      isOwn
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {/* Image */}
                    {msg.media_type === 'image' && (
                      <img
                        src={msg.media_url}
                        alt="shared"
                        className="max-w-[260px] max-h-[300px] rounded-[18px] object-cover cursor-pointer"
                        onClick={() => window.open(msg.media_url, '_blank')}
                      />
                    )}

                    {/* File */}
                    {msg.media_type === 'file' && (
                      <a
                        href={msg.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 px-3 py-2 rounded-[16px] ${isOwn ? 'bg-blue-700' : 'bg-slate-200'}`}
                      >
                        <svg className="w-8 h-8 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold truncate max-w-[180px]">{msg.file_name}</span>
                          <span className="text-xs opacity-70">{(Number(msg.file_size) / 1024).toFixed(1)} KB</span>
                        </div>
                      </a>
                    )}

                    {/* Text */}
                    {msg.text && <span style={{ padding: msg.media_url ? '4px 8px' : '' }} className={msg.media_url ? 'block mt-1' : ''}>{msg.text}</span>}
                  </div>
                </div>
              </div>

              <div className={`flex items-center gap-1 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[11px] text-[#6b7280]">{timeString}</span>
                {isOwn && (
                  <svg
                    className={`w-[16px] h-[16px] ${msg.read_by?.length > 1 ? 'text-[#53bdeb]' : 'text-[#6b7280]'}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  >
                    {msg.read_by?.length > 1 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 13l4 4L16 8M9 13l4 4L22 8" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    )}
                  </svg>
                )}
              </div>
            </div>
          );
        })}

        {typingIndicator && (
          <div className="flex justify-start w-full mt-2">
            <div className="flex items-end gap-2">
              <img
                src={selectedChatUser.avatar || assets.avatar_icon}
                className="w-8 h-8 rounded-[12px] mb-1 flex-shrink-0 border border-white/10"
                alt=""
              />
              <div className="bg-[#e8e8ee] px-4 w-[68px] h-[44px] rounded-[22px] rounded-bl-[5px] flex gap-1.5 items-center justify-center">
                <span className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* ── INPUT AREA ── */}
      <div className="px-4 md:px-6 py-3 md:py-4 bg-white border-t border-slate-200 relative z-20">
        <div className="h-12 bg-slate-50 rounded-xl flex items-center px-2 gap-2 border border-slate-200 focus-within:bg-white focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all duration-300">
          
          <input
            ref={fileinputref}
            type="file"
            accept="*"
            className="hidden"
            onChange={handlemediaupload}
          />
          <button
            onClick={() => fileinputref.current?.click()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all focus:outline-none flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          </button>
          
          <button className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all focus:outline-none flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </button>

          <input
            value={input}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            disabled={sending}
            placeholder="Type your message..."
            className="flex-1 bg-transparent px-2 flex-shrink min-w-0 border-none outline-none text-[14px] font-medium text-slate-700 placeholder:text-slate-400 h-full"
          />

          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>

        </div>
      </div>
    </div>
  )
}

export default Chatbox