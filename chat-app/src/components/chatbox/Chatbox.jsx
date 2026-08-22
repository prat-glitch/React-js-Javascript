import React, { useState, useEffect, useContext, useRef, useCallback } from 'react'
import EmojiPicker from 'emoji-picker-react'
import assets from '../../assets/assets'
import { Appcontext } from '../../context/Appcontext'
import { getSupabase } from '../../config/supabase'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import Audiocallbar from '../calls/Audiocallbar'
import { encryptMessage, decryptMessage, parseEncryptedPayload } from '../../lib/crypto'

const Chatbox = ({ setMobileView, setShowContactInfo }) => {
  const { userdata, selectedChatUser, getChatId, theme } = useContext(Appcontext)
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typingIndicator, setTypingIndicator] = useState(false)
  // Map of msgId → decrypted plaintext string (null = decryption failed)
  const [decryptedTexts, setDecryptedTexts] = useState(new Map())
  // Ref mirrors decryptedTexts so useCallback closures always see the latest Map
  // without needing decryptedTexts in the dependency array (avoids infinite loops).
  const decryptedTextsRef = useRef(new Map())
  // Track per-message decryption failure counts so we can retry (up to MAX_DECRYPT_RETRIES)
  const decryptRetryCountRef = useRef(new Map())
  const decryptRetryTimerRef = useRef(null)
  const MAX_DECRYPT_RETRIES = 3

  const messagesEndRef = useRef(null)
  const currentChatIdRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)
  const channelRef = useRef(null)
  const fileinputref = useRef(null)
  const emojiPickerRef = useRef(null)

  // ── Date separator helper ─────────────────────────────────────────────────
  const getDateLabel = useCallback((timestamp) => {
    const msgDate = new Date(Number(timestamp))
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const isSameDay = (d1, d2) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()

    if (isSameDay(msgDate, today)) return 'Today'
    if (isSameDay(msgDate, yesterday)) return 'Yesterday'

    return msgDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  // Keep the ref in sync whenever the state updates
  useEffect(() => {
    decryptedTextsRef.current = decryptedTexts
  }, [decryptedTexts])

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
  // ── Audio recording states ───────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingIntervalRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingIndicator])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmojiPicker])

  const handleEmojiClick = (emojiObject) => {
    setInput(prev => prev + emojiObject.emoji)
  }

  // ── E2EE: decrypt messages asynchronously ─────────────────────────────────
  //
  // ECDH symmetry: A.private + B.public == B.private + A.public (same shared key)
  // so we always use MY private key + the OTHER party's public key,
  // regardless of who sent the message.
  //
  // Retry logic: failed decryptions are NOT permanently cached as null.
  // Instead we track per-message failure counts and retry up to MAX_DECRYPT_RETRIES
  // times with a 2-second delay between attempts. This handles the race condition
  // where the other party's public key hasn't propagated yet.
  const decryptAll = useCallback(async () => {
    if (!selectedChatUser?.uid || !userdata?.uid) return

    // ── Resolve other party's public key ─────────────────────────────
    // Try cached value first; fall back to a fresh Supabase read if null.
    let otherPublicKey = selectedChatUser?.public_key ?? null
    if (!otherPublicKey) {
      const { data } = await getSupabase()
        .from('users')
        .select('public_key')
        .eq('uid', selectedChatUser.uid)
        .maybeSingle()
      otherPublicKey = data?.public_key ?? null
    }
    if (!otherPublicKey) return // other party hasn't registered E2EE yet

    // ── Use ref to avoid stale Map from closure ────────────────────────
    const updated = new Map(decryptedTextsRef.current)
    const retryCounts = decryptRetryCountRef.current
    let changed = false
    let hasRetryable = false

    for (const msg of messages) {
      // Skip already-successfully-decrypted messages
      if (updated.has(msg.id) && updated.get(msg.id) !== null) continue
      // Skip permanently-failed messages (exhausted retries)
      const attempts = retryCounts.get(msg.id) || 0
      if (updated.has(msg.id) && updated.get(msg.id) === null && attempts >= MAX_DECRYPT_RETRIES) continue

      const payload = parseEncryptedPayload(msg.text)
      if (!payload) continue // plain text (old message) — nothing to do

      try {
        const plaintext = await decryptMessage(
          payload.ciphertext,
          payload.iv,
          otherPublicKey,
          userdata.uid,
        )
        updated.set(msg.id, plaintext)
        retryCounts.delete(msg.id) // clear retry count on success
      } catch (err) {
        const newCount = attempts + 1
        retryCounts.set(msg.id, newCount)
        if (newCount >= MAX_DECRYPT_RETRIES) {
          console.error(`[E2EE] Decryption permanently failed for msg ${msg.id} after ${newCount} attempts`, err)
          updated.set(msg.id, null) // null → show fallback text
        } else {
          console.warn(`[E2EE] Decryption attempt ${newCount}/${MAX_DECRYPT_RETRIES} failed for msg ${msg.id}, will retry...`)
          hasRetryable = true
          // Don't set in map yet — leave it un-cached so it shows as "pending"
        }
      }
      changed = true
    }

    if (changed) {
      decryptedTextsRef.current = updated
      setDecryptedTexts(new Map(updated))
    }

    // Schedule a retry for messages that failed but haven't exhausted retries
    if (hasRetryable) {
      if (decryptRetryTimerRef.current) clearTimeout(decryptRetryTimerRef.current)
      decryptRetryTimerRef.current = setTimeout(() => {
        decryptAll()
      }, 2000)
    }
  }, [messages, selectedChatUser?.uid, selectedChatUser?.public_key, userdata?.uid])
  // NOTE: decryptedTexts intentionally omitted — we use decryptedTextsRef instead.

  useEffect(() => {
    decryptAll()
    return () => {
      if (decryptRetryTimerRef.current) clearTimeout(decryptRetryTimerRef.current)
    }
  }, [decryptAll])

  // Reset decrypted cache AND retry counts when switching conversations
  useEffect(() => {
    const empty = new Map()
    decryptedTextsRef.current = empty
    setDecryptedTexts(empty)
    decryptRetryCountRef.current = new Map()
    if (decryptRetryTimerRef.current) {
      clearTimeout(decryptRetryTimerRef.current)
      decryptRetryTimerRef.current = null
    }
  }, [selectedChatUser?.uid])

  // ── Voice message helpers ──────────────────────────────────────────────────
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Audio recording is not supported in this browser context (MediaRecorder undefined).');
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is disabled or not supported in this browser context. Note: browsers require HTTPS or localhost for audio access.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      } catch (e) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
        } catch (e2) {
          try {
            recorder = new MediaRecorder(stream, { mimeType: 'audio/ogg' });
          } catch (e3) {
            recorder = new MediaRecorder(stream);
          }
        }
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (audioBlob.size > 0) {
            await sendAudioMessage(audioBlob);
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      toast.error(err.message || 'Could not access microphone');
    }
  };

  const stopRecording = (shouldSend) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    if (!shouldSend) {
      audioChunksRef.current = [];
    }
    
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const sendAudioMessage = async (audioBlob) => {
    setSending(true);
    try {
      const chatId = currentChatIdRef.current;
      const filename = `voice_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`;
      const storagepath = `${userdata.uid}/${chatId}/${filename}`;

      const supabase = getSupabase();
      
      const { error: uploaderror } = await supabase.storage.from('chat-media').upload(storagepath, audioBlob, {
        contentType: audioBlob.type || 'audio/webm',
        cacheControl: '3600'
      });
      
      if (uploaderror) throw uploaderror;

      const { data: signeddata } = await supabase.storage.from('chat-media').createSignedUrl(storagepath, 60 * 60 * 24 * 365);

      const { error } = await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: userdata.uid,
        text: '',
        media_url: signeddata.signedUrl,
        media_type: 'audio',
        file_name: `Voice Message (${formatTime(recordingTime)})`,
        file_size: audioBlob.size,
        created_at: Date.now(),
        read_by: [userdata.uid]
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error sending audio message:', err);
      toast.error('Failed to send voice message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

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

    const channel = getSupabase().channel(`chat:${chatId}`);

    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`
    }, async (payload) => {
      const newMessage = payload.new;
      setMessages(prev => [...prev, newMessage]);

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

    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `chat_id=eq.${chatId}`
    }, (payload) => {
      setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
    });

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

      // ── E2EE: resolve recipient's public key (with fresh-fetch fallback) ──────
      let recipientPublicKey = selectedChatUser?.public_key ?? null
      if (!recipientPublicKey) {
        const { data } = await getSupabase()
          .from('users')
          .select('public_key')
          .eq('uid', selectedChatUser.uid)
          .maybeSingle()
        recipientPublicKey = data?.public_key ?? null
      }

      let storedText = text
      if (recipientPublicKey) {
        try {
          const payload = await encryptMessage(text, recipientPublicKey, userdata.uid)
          storedText = JSON.stringify(payload)
        } catch (cryptoErr) {
          console.warn('[E2EE] Encryption failed, sending plaintext:', cryptoErr)
        }
      }

      const { error } = await getSupabase().from('messages').insert({
        chat_id: chatId,
        sender_id: userdata.uid,
        text: storedText,
        created_at: Date.now(),
        read_by: [userdata.uid]
      });

      if (error) throw error;
    } catch (err) {
      console.error("send error:", err);
      toast.error('Failed to send message');
    }

    setSending(false);
  };

  const handlemediaupload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileinputref.current) fileinputref.current.value = '';

    const MAX_SIZE = 20 * 1024 * 1024;
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
    } catch (err) {
      console.error("Upload error:", err);
      toast.error('Failed to send file');
    }
    setSending(false);
  };

  if (!selectedChatUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-[#0b141a]">
        <div className="w-20 h-20 mb-6 relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-100 dark:bg-slate-800"></div>
          <div className="absolute inset-0 flex items-center justify-center text-blue-600 dark:text-emerald-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2 tracking-tight text-slate-800 dark:text-slate-100">Samlap</h2>
        <p className="max-w-sm text-sm font-medium text-slate-500 dark:text-slate-400">Select a conversation from the sidebar to begin messaging.</p>
      </div>
    )
  }

  const isOnline = selectedChatUser.online || false;

  return (
    <div className="flex-1 h-full flex flex-col relative bg-[#e5ddd5] dark:bg-[#0b141a]">

      {/* ── HEADER ── */}
      <div className="h-[68px] md:h-[60px] px-3 md:px-4 border-b flex items-center justify-between flex-shrink-0 z-10 relative bg-[#ededed] dark:bg-[#202c33] border-slate-300/40 dark:border-white/5">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Back button — mobile only */}
          <button
            onClick={() => setMobileView('sidebar')}
            className="md:hidden w-11 h-11 min-w-0 rounded-full flex items-center justify-center transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
            aria-label="Back to chats"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
          </button>

          <button
            onClick={() => setShowContactInfo && setShowContactInfo(true)}
            className="flex items-center gap-3 group cursor-pointer text-left min-w-0 active:opacity-80 transition-opacity"
          >
            <div className="relative flex-shrink-0">
              <img src={selectedChatUser.avatar || assets.avatar_icon} className="w-11 h-11 md:w-10 md:h-10 rounded-full object-cover shadow-sm border border-white dark:border-slate-700/50" alt="" />
              {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#ededed] dark:border-[#202c33]"></span>}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[17px] md:text-sm font-semibold leading-tight truncate transition-colors text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-emerald-400">{selectedChatUser.username}</h3>
              </div>
              <div className="text-[13px] md:text-[11px] font-medium mt-0.5">
                {typingIndicator ? (
                  <span className="text-blue-600 dark:text-emerald-400">typing...</span>
                ) : isOnline ? (
                  <span className="text-blue-600 dark:text-emerald-400">online</span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    {selectedChatUser.lastseen ? `last seen ${selectedChatUser.lastseen}` : 'offline'}
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="ml-2 md:ml-4 flex-shrink-0">
            <Audiocallbar />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
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
              
              getSupabase().functions.invoke('send-push', {
                body: {
                  isCall: true,
                  callerName: userdata.username,
                  callType: 'audio',
                  chatId: chatId,
                  recipientIds: [selectedChatUser.uid]
                }
              });

              navigate(`/call/${chatId}?type=audio&role=caller`)
            }}
            className="w-12 h-12 md:w-11 md:h-11 rounded-lg flex items-center justify-center transition-all duration-200 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 active:scale-95"
          >
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

              getSupabase().functions.invoke('send-push', {
                body: {
                  isCall: true,
                  callerName: userdata.username,
                  callType: 'video',
                  chatId: chatId,
                  recipientIds: [selectedChatUser.uid]
                }
              });

              navigate(`/call/${chatId}?type=video&role=caller`)
            }}
            className="w-12 h-12 md:w-11 md:h-11 rounded-lg flex items-center justify-center transition-all duration-200 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <button className="w-12 h-12 md:w-11 md:h-11 rounded-lg flex items-center justify-center transition-all duration-200 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95">
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
          </button>
        </div>
      </div>

      {/* ── MESSAGES LIST ── */}
      <div
        className="flex-1 relative flex flex-col overflow-hidden opacity-[0.96]"
        style={{ backgroundColor: theme === 'dark' ? '#0b141a' : '#efeae2' }}
      >
        {/* Background Image Layer */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
            backgroundRepeat: 'repeat',
            opacity: theme === 'dark' ? 0.05 : 0.4,
            filter: theme === 'dark' ? 'invert(1)' : 'none'
          }}
        />

        <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 flex flex-col gap-2 custom-scrollbar relative z-10">

        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === userdata.uid;
          const timeString = new Date(Number(msg.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

          // ── Date separator: show pill when date changes from previous message ──
          const currentDateLabel = getDateLabel(msg.created_at)
          const prevDateLabel = i > 0 ? getDateLabel(messages[i - 1].created_at) : null
          const showDateSeparator = i === 0 || currentDateLabel !== prevDateLabel

          const bubbleBg = isOwn
            ? (theme === 'dark' ? '#005c4b' : '#97ee88ff')
            : (theme === 'dark' ? '#202c33' : '#ffffff');
          const bubbleTextColor = theme === 'dark' ? '#e9edef' : '#111b21';

          // ── Resolve display text with E2EE decryption ──────────────────────
          // parseEncryptedPayload returns {ciphertext,iv} if JSON, else null.
          const encPayload = parseEncryptedPayload(msg.text)
          let displayText = msg.text // default: render as-is (plaintext / old message)
          let decryptPending = false

          if (encPayload) {
            if (decryptedTexts.has(msg.id)) {
              const dec = decryptedTexts.get(msg.id)
              if (dec !== null) {
                displayText = dec
              } else {
                // Decryption permanently failed — hide this message
                return null
              }
            } else {
              decryptPending = true
              displayText = ''
            }
          }

          return (
            <React.Fragment key={msg.id || i}>
              {showDateSeparator && (
                <div className="flex justify-center my-3">
                  <span className="text-[11px] rounded-md px-2.5 py-1 shadow-sm font-medium bg-white dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] border border-slate-200/50 dark:border-transparent">
                    {currentDateLabel}
                  </span>
                </div>
              )}
            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} w-full mb-0.5 px-2 md:px-6`}>
              <div className={`flex max-w-[92%] md:max-w-[70%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end gap-1.5`}>

                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-full`}>
                  <div
                    style={{
                      padding: msg.media_url ? '3px' : '6px 10px 8px 10px',
                      backgroundColor: bubbleBg,
                      color: bubbleTextColor
                    }}
                    className="relative text-[15.5px] md:text-[14.2px] leading-relaxed break-words whitespace-pre-wrap rounded-lg shadow-sm border border-slate-200/40 dark:border-transparent w-full"
                  >
                    {/* Image */}
                    {msg.media_type === 'image' && (
                      <img
                        src={msg.media_url}
                        alt="shared"
                        className="max-w-[280px] max-h-[300px] rounded-md object-cover cursor-pointer"
                        onClick={() => window.open(msg.media_url, '_blank')}
                      />
                    )}

                    {/* File */}
                    {msg.media_type === 'file' && (
                      <a
                        href={msg.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 px-3 py-2 rounded-md ${isOwn ? (theme === 'dark' ? '#004c3e' : '#c7ebd1') : (theme === 'dark' ? '#182229' : '#f0f2f5')}`}
                        style={{ color: bubbleTextColor }}
                      >
                        <svg className={`w-8 h-8 flex-shrink-0 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex flex-col min-w-0 text-left">
                          <span className="text-sm font-semibold truncate max-w-[180px]">{msg.file_name}</span>
                          <span className="text-xs opacity-75">{(Number(msg.file_size) / 1024).toFixed(1)} KB</span>
                        </div>
                      </a>
                    )}

                    {/* Audio Voice Message */}
                    {msg.media_type === 'audio' && (
                      <div className="flex flex-col gap-1.5 p-1 min-w-[220px] max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <svg className="w-8 h-8 flex-shrink-0 text-slate-500 dark:text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zm0 16a7 7 0 01-7-7 1 1 0 10-2 0 9 9 0 008 8.94V21h-2a1 1 0 100 2h6a1 1 0 100-2h-2v-2.06A9 9 0 0021 11a1 1 0 10-2 0 7 7 0 01-7 7z"/>
                          </svg>
                          <audio
                            src={msg.media_url}
                            controls
                            className="w-full h-8 custom-audio-player"
                          />
                        </div>
                        <span className="text-[11px] opacity-75 font-semibold px-1">
                          {msg.file_name || 'Voice Message'}
                        </span>
                      </div>
                    )}

                    {/* Text + Time Row inside the bubble */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-x-4 gap-y-1 mt-1">
                      <span className={`${msg.media_url ? 'block mt-0.5' : 'block'} break-all sm:break-normal`}>
                        {decryptPending ? (
                          // Skeleton shimmer while decryption runs
                          <span className="inline-block w-24 h-3.5 rounded bg-current opacity-20 animate-pulse" />
                        ) : (
                          displayText
                        )}
                      </span>

                      <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-auto" style={{ transform: 'translateY(2px)' }}>
                        <span className="text-[10px] select-none text-[#667781] dark:text-[#8696a0] font-medium">{timeString}</span>
                        {isOwn && (
                          <svg
                            className={`w-[14px] h-[14px] ${msg.read_by?.length > 1 ? 'text-[#53bdeb]' : 'text-slate-400'}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          >
                            {msg.read_by?.length > 1 ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 13l4 4L16 8M9 13l4 4L22 8" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            )}
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </React.Fragment>
          );
        })}

        {typingIndicator && (
          <div className="flex justify-start w-full mt-1 px-2 md:px-6">
            <div className="flex items-end gap-2">
              <div
                className="px-3.5 w-[56px] h-[32px] rounded-lg flex gap-1 items-center justify-center shadow-sm bg-white dark:bg-[#202c33] border border-slate-200/50 dark:border-transparent"
              >
                <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* ── INPUT AREA ── */}
      <div
        className="px-3 md:px-14 py-2 md:py-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-6 relative z-20 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-300/40 dark:border-transparent"
      >

        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-[60px] left-6 md:left-14 z-50 shadow-2xl rounded-lg"
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={theme === 'dark' ? 'dark' : 'light'}
              lazyLoadEmojis={true}
              searchPlaceholder="Search emojis…"
              skinTonesDisabled
              height={360}
              width={310}
            />
          </div>
        )}

        <div className="flex items-end gap-2 md:gap-3 w-full">
          
          <input
            ref={fileinputref}
            type="file"
            accept="*"
            className="hidden"
            onChange={handlemediaupload}
          />
          
          {/* Plus icon to add attachments (Outside Pill) */}
          <button
            onClick={() => fileinputref.current?.click()}
            className="w-12 h-12 md:w-11 md:h-11 mb-[5px] rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/60 active:scale-95 transition-all duration-200 focus:outline-none flex-shrink-0"
          >
            <svg className="w-6 h-6 md:w-[22px] md:h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
          </button>

          {/* Input Pill Container */}
          <div 
            className="flex-1 min-h-[56px] md:min-h-[52px] flex items-end px-2 py-1.5 gap-2 rounded-[28px] shadow-sm"
            style={{ 
              backgroundColor: theme === 'dark' ? '#2a3942' : '#ffffff',
            }}
          >
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between px-3 h-10 select-none">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                  <span className="text-[13px] font-bold text-red-500 uppercase tracking-wide">Recording</span>
                  <span className="text-sm font-bold ml-2 text-slate-700 dark:text-slate-200">{formatTime(recordingTime)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => stopRecording(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all"
                  title="Discard Recording"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                {/* Smiley icon */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  className={`w-11 h-11 mb-[1px] rounded-full flex items-center justify-center transition-all focus:outline-none flex-shrink-0 ${showEmojiPicker
                    ? (theme === 'dark' ? 'bg-slate-700 text-emerald-400' : 'bg-slate-100 text-emerald-500')
                    : ('text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60')
                    }`}
                  title="Emoji"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                <textarea
                  value={input}
                  onChange={handleTyping}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={sending}
                  placeholder="Type a message"
                  rows="1"
                  className="flex-1 max-h-[120px] min-h-[40px] py-2.5 px-2 bg-transparent border-none outline-none text-[16px] md:text-[15px] resize-none overflow-y-auto custom-scrollbar"
                  style={{ 
                    color: theme === 'dark' ? '#e9edef' : '#111b21',
                  }}
                />
              </>
            )}
          </div>

          {/* Send / Mic Button (Outside Pill) */}
          {isRecording ? (
            <button
              onClick={() => stopRecording(true)}
              className="w-12 h-12 md:w-11 md:h-11 mb-[5px] rounded-full flex items-center justify-center transition-all duration-200 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white shadow-sm flex-shrink-0"
              title="Send Voice Message"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={input.trim() ? sendMessage : startRecording}
              disabled={sending}
              className="w-12 h-12 md:w-11 md:h-11 mb-[5px] rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/60 active:scale-95"
              title={input.trim() ? "Send Message" : "Record Audio Message"}
            >
              {input.trim() ? (
                <svg className={`w-[20px] h-[20px] ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-500'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              ) : (
                <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}

export default Chatbox