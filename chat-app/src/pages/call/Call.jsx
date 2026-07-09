import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Appcontext } from '../../context/Appcontext';
import { getSupabase } from '../../config/supabase';
import Sidebar from '../../components/sidebar/Sidebar';
import Chat from '../chat/Chat';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
     {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

const VideoTile = ({ stream, label, muted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.warn);
    }
  }, [stream]);

  return (
    <div className="relative bg-[#050b16] rounded-xl overflow-hidden min-h-[180px]">
      <video ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
       className="w-full h-full object-cover bg-[#050b16]" />
      <span className="absolute left-2.5 bottom-2.5 bg-black/60 py-1 px-2 rounded-[10px] text-xs text-white">{label}</span>
    </div>
  );
};

const Call = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const initiator = searchParams.get('role') === 'caller';
  const navigate = useNavigate();
  const { userdata } = useContext(Appcontext);
  const callType = searchParams.get('type') === 'audio' ? 'audio' : 'video';

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState({});
  const [status, setStatus] = useState('Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType === 'audio');
  const [isMinimized, setIsMinimized] = useState(false);
  
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const channelRef = useRef(null);
  const cleanedUpRef = useRef(false);
  const localStreamRef = useRef(null);

  const sortedRemoteIds = useMemo(() => Object.keys(remoteStreams).sort(), [remoteStreams]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Init local media
  useEffect(() => {
    let cancelled = false;
    sessionStorage.setItem('callType', callType);
    if (!sessionStorage.getItem('callStartTime')) {
      sessionStorage.setItem('callStartTime', Date.now().toString());
    }

    const handleMax = () => setIsMinimized(false);
    window.addEventListener('maximize-call', handleMax);

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true, 
            autoGainControl: true 
          }
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        setLocalStream(stream);
        localStreamRef.current = stream;
        setIsMuted(false);
        setIsCameraOff(callType === 'audio');
        setStatus('Connected');
      } catch (error) {
        console.error('Failed to access media devices:', error);
        setStatus('Camera/microphone access denied');
      }
    };

    initMedia();

    return () => {
      cancelled = true;
      window.removeEventListener('maximize-call', handleMax);
    };
  }, [callType]);

  const sendSignal = async (payload) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: { ...payload }
    });
  };

  const ensurePeerConnection = async (peerId, initiator) => {
    if (peerConnectionsRef.current.has(peerId) || !localStream) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(peerId, pc);

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'candidate',
          from: userdata.uid,
          to: peerId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const existingStream = prev[peerId];
        if (existingStream) {
          existingStream.addTrack(event.track);
          // Return a new object reference so React re-renders, but keep the same MediaStream reference
          return { ...prev };
        }
        const newStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        return { ...prev, [peerId]: newStream };
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === "closed") {
        cleanup().then(() => navigate('/chat', { state: { message: 'Call ended' } }));
        setRemoteStreams((prev) => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal({
        type: 'offer',
        from: userdata.uid,
        to: peerId,
        sdp: pc.localDescription.toJSON()
      });
    }
  };

  const handleSignal = async (data) => {
    const peerId = data.from;
    if (peerId === userdata.uid || data.to !== userdata.uid) return;

    if (data.type === 'end_call') {
      await cleanup();
      navigate('/chat', { state: { message: 'Call ended' } });
      return;
    }

    if (!peerConnectionsRef.current.has(peerId)) {
      await ensurePeerConnection(peerId, false);
    }

    const pc = peerConnectionsRef.current.get(peerId);
    if (!pc) return;

    try {
      if (data.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({
          type: 'answer',
          from: userdata.uid,
          to: peerId,
          sdp: pc.localDescription.toJSON()
        });

        const queued = pendingCandidatesRef.current.get(peerId) || [];
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
        }
        pendingCandidatesRef.current.delete(peerId);
      }

      if (data.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const queued = pendingCandidatesRef.current.get(peerId) || [];
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
        }
        pendingCandidatesRef.current.delete(peerId);
      }

      if (data.type === 'candidate') {
        if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.warn);
        } else {
          const existing = pendingCandidatesRef.current.get(peerId) || [];
          pendingCandidatesRef.current.set(peerId, [...existing, data.candidate]);
        }
      }
    } catch (error) {
      console.error('Error handling signal:', error);
    }
  };

  // Setup Supabase Realtime for Calling
  useEffect(() => {
    if (!userdata?.uid || !roomId || !localStream) return;

    const channel = getSupabase().channel(`call:${roomId}`, {
      config: { presence: { key: userdata.uid } }
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const parts = {};
        Object.keys(state).forEach(key => {
          parts[key] = state[key][0]; // Take first presence object for that key
          // If we are the initiator, ensure we connect to users already in the room
          if (key !== userdata.uid && initiator) {
            ensurePeerConnection(key, true);
          }
        });
        setParticipants(parts);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== userdata.uid) {
          setTimeout(() => ensurePeerConnection(key, initiator), 500);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== userdata.uid) {
          cleanup().then(() => navigate('/chat', { state: { message: 'Call ended' } }));
        }
      })
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        handleSignal(payload);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            uid: userdata.uid, 
            username: userdata.username, 
            avatar: userdata.avatar 
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [userdata?.uid, roomId, localStream]);

  const cleanup = async () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    sessionStorage.removeItem('callStartTime');
    sessionStorage.removeItem('callType');

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (channelRef.current) {
      await channelRef.current.untrack();
    }
  };

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  const handleLeave = async () => {
    const otherpeerids = Object.keys(participants).filter(id => id !== userdata.uid);
    for (const peerid of otherpeerids) {
      await sendSignal({ type: 'end_call', from: userdata.uid, to: peerid });
    }
    
    window.dispatchEvent(new CustomEvent("call-ended"));
    await cleanup();
    navigate('/chat', { state: { message: 'Call ended' } });
  };

  const toggleMute = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => track.enabled = isMuted);
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track) => track.enabled = isCameraOff);
    setIsCameraOff(!isCameraOff);
  };

  if (userdata === null) return <div className="loading">Loading call...</div>;
  if (!userdata?.avatar || !userdata?.username) return <Navigate to="/profile" />;

  if (isMinimized) {
    const peerName = Object.values(participants).find(p => p.uid !== userdata.uid)?.username || 'User';
    return (
      <div className="relative w-full h-screen overflow-hidden">
        <div style={{ display: 'none' }}>
          <VideoTile stream={localStream} label="You" muted={true} />
          {sortedRemoteIds.map((peerId) => (
             <VideoTile key={peerId} stream={remoteStreams[peerId]} label={participants[peerId]?.username || 'Guest'} />
          ))}
        </div>

        <div className="absolute inset-0 z-0">
          <Chat />
        </div>
        {callType === 'audio' ? (
          <div className="absolute top-0 left-0 w-full z-[100] h-1" />
        ) : (
          <div 
            className="absolute bottom-6 right-6 z-50 w-64 md:w-80 aspect-[4/3] bg-slate-900 rounded-2xl shadow-2xl border-2 border-slate-700 overflow-hidden cursor-pointer hover:border-slate-500 transition-colors group"
            onClick={() => setIsMinimized(false)}
          >
            {sortedRemoteIds.length > 0 ? (
              <VideoTile stream={remoteStreams[sortedRemoteIds[0]]} label={peerName} />
            ) : (
              <VideoTile stream={localStream} label="You" muted={true} />
            )}
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${isMuted ? 'bg-red-500 text-white' : 'bg-slate-700/80 text-white backdrop-blur-sm hover:bg-slate-600'}`}>
                {isMuted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                )}
              </button>
              {callType === 'video' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleCamera(); }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isCameraOff ? 'bg-red-500 text-white' : 'bg-slate-700/80 text-white backdrop-blur-sm hover:bg-slate-600'}`}>
                  {isCameraOff ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3l18 18"></path></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  )}
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); handleLeave(); }}
                className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-transform">
                <svg className="w-4 h-4 transform rotate-135" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden px-4 py-6 md:px-8 md:py-8 flex items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_35%,_#f1f5f9_70%,_#e2e8f0_100%)]">
      <div className="pointer-events-none absolute -top-32 -left-24 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(37,99,235,0.35),_rgba(59,130,246,0.05))] blur-3xl"></div>
      <div className="pointer-events-none absolute top-24 -right-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.25),_rgba(148,163,184,0.05))] blur-3xl"></div>
      
      <div className="relative w-full h-[calc(100vh-3rem)] max-w-[1360px] max-h-[960px] rounded-[36px] bg-white/70 border border-white/70 shadow-[0_40px_120px_rgba(15,23,42,0.12)] backdrop-blur-2xl p-2 md:p-3">
        <div className="w-full h-full rounded-[30px] bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] flex overflow-hidden gap-4 md:gap-5">
          <div className="hidden lg:flex flex-shrink-0 h-full md:w-[320px] lg:w-[440px] xl:w-[480px] rounded-[28px] overflow-hidden bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-white/80">
            <Sidebar />
          </div>
          
          <div className="flex-1 h-full min-w-0 flex flex-col bg-slate-900 rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.08)] relative z-20">
            <div className="flex items-center justify-between py-5 px-6 border-b border-white/5 bg-black/20 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <button onClick={handleLeave} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-white capitalize">{callType} Call</h3>
                  <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Secure Encrypted Connection
                  </p>
                </div>
              </div>
              <button onClick={() => setIsMinimized(true)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors backdrop-blur-sm border border-white/10">
                Minimize
              </button>
            </div>

            <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-900/50 to-slate-900 z-10 pointer-events-none"></div>
              
              <div className={`w-full max-w-5xl relative z-20 grid gap-4 transition-all duration-500 ease-out
                ${sortedRemoteIds.length === 0 ? 'grid-cols-1 max-w-2xl' : 
                  sortedRemoteIds.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 
                  sortedRemoteIds.length <= 3 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}
              >
                <div className={`transition-all duration-500 ${sortedRemoteIds.length === 0 ? 'aspect-square md:aspect-video' : 'aspect-[4/3]'} max-w-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl relative group`}>
                  <VideoTile stream={localStream} label="You" muted={true} />
                  {isMuted && (
                    <div className="absolute top-4 right-4 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    </div>
                  )}
                </div>

                {sortedRemoteIds.map((peerId) => (
                  <div key={peerId} className="aspect-[4/3] w-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl relative bg-slate-800">
                    <VideoTile stream={remoteStreams[peerId]} label={participants[peerId]?.username || 'Guest'} />
                  </div>
                ))}
              </div>

              {sortedRemoteIds.length === 0 && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 text-center pointer-events-none flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin mb-6"></div>
                  <h3 className="text-2xl font-bold text-white mb-2">{status}</h3>
                  <p className="text-slate-400">Waiting for others to join...</p>
                </div>
              )}
            </div>

            <div className="py-6 px-8 bg-slate-900 border-t border-white/5 relative z-30">
              <div className="flex items-center justify-center gap-6">
                <button onClick={toggleMute} className={`w-14 h-14 rounded-[20px] flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                  )}
                </button>
                
                <button onClick={handleLeave} className="w-20 h-16 rounded-[24px] bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(239,68,68,0.3)] transition-transform hover:scale-105 active:scale-95">
                  <svg className="w-8 h-8 transform rotate-135" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                </button>

                {callType === 'video' && (
                  <button onClick={toggleCamera} className={`w-14 h-14 rounded-[20px] flex items-center justify-center transition-all ${isCameraOff ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'}`}>
                    {isCameraOff ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3l18 18"></path></svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Call;