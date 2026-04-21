import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, addDoc } from 'firebase/firestore';
import { Appcontext } from '../../context/Appcontext';
import { useSocket } from '../../context/SocketContext';
import { db } from '../../config/firebase';
import Sidebar from '../../components/sidebar/Sidebar';
import Rightsidebar from '../../components/rightsidebar/Rightsidebar';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

const VideoTile = ({ stream, label, muted = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-[#050b16] rounded-xl overflow-hidden min-h-[180px]">
      <video ref={videoRef} className="w-full h-full object-cover bg-[#050b16]" autoPlay playsInline muted={muted} />
      <span className="absolute left-2.5 bottom-2.5 bg-black/60 py-1 px-2 rounded-[10px] text-xs">{label}</span>
    </div>
  );
};

const Call = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
   
  const initiator = searchParams.get('role') === 'caller';

  const navigate = useNavigate();
  const { userdata } = useContext(Appcontext);
  const { socket } = useSocket();

  const callType = searchParams.get('type') === 'audio' ? 'audio' : 'video';

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState({});
  const [status, setStatus] = useState('Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(callType === 'audio');

  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const roomRefRef = useRef(null);
  const cleanedUpRef = useRef(false);
  const localStreamRef = useRef(null);

  const sortedRemoteIds = useMemo(() => Object.keys(remoteStreams).sort(), [remoteStreams]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    let cancelled = false;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true
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
    };
  }, [callType]);

  const sendSignal = async (payload) => {
    if (!roomRefRef.current) return;
    await addDoc(collection(roomRefRef.current, 'signals'), {
      ...payload,
      createdAt: serverTimestamp()
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
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
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

  const handleSignal = async (signalDoc) => {
    const data = signalDoc.data();
    const peerId = data.from;

    if (peerId === userdata.uid) return;

    // Handle end call signal
    if (data.type === 'end_call') {
      await deleteDoc(signalDoc.ref);
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
    await deleteDoc(signalDoc.ref);
  };

  // Socket call rejection handler
  useEffect(() => {
    if (!socket) return;
    
    const handleRejected = () => {
      // Removed blocking alert to allow immediate navigation
      navigate('/chat', { state: { message: 'The call was declined' } }); 
    };

    socket.on('call:rejected', handleRejected);

    return () => {
      socket.off('call:rejected', handleRejected);
    };
  }, [socket, navigate]);

  useEffect(() => {
    if (!userdata?.uid || !roomId || !localStream) return;

    const roomRef = doc(db, 'calls', roomId);
    roomRefRef.current = roomRef;

    const joinRoom = async () => {
      await setDoc(roomRef, { updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(
        doc(roomRef, 'participants', userdata.uid),
        {
          uid: userdata.uid,
          username: userdata.username || 'User',
          avatar: userdata.avatar || '',
          joinedAt: serverTimestamp()
        },
        { merge: true }
      );
    };

    joinRoom();

    const participantsUnsub = onSnapshot(collection(roomRef, 'participants'), (snap) => {
      const current = {};
      snap.forEach((p) => {
        current[p.id] = p.data();
      });
      setParticipants(current);

      snap.docChanges().forEach((change) => {
        const peerId = change.doc.id;
        if (peerId === userdata.uid) return;
        
        if (change.type !== 'added' && change.type !== 'removed') {
          ensurePeerConnection(peerId, initiator);
        }

        if (change.type === 'removed') {
          // Fixed syntax error here: cleanup() instead of cleanup
          cleanup().then(() => {
            navigate('/chat', { state: { message: 'Call ended' } });
          });
        }
      });
    });

    const signalsQuery = query(
      collection(roomRef, 'signals'),
      where('to', '==', userdata.uid)
    );

    const signalsUnsub = onSnapshot(signalsQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        handleSignal(change.doc);
      });
    });

    return () => {
      participantsUnsub();
      signalsUnsub();
    };
  }, [userdata?.uid, roomId, localStream]);

  const cleanup = async () => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (roomRefRef.current && userdata?.uid) {
      await deleteDoc(doc(roomRefRef.current, 'participants', userdata.uid));
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Foolproof fallback mechanism
  useEffect(() => {
    const participantCount = Object.keys(participants).length;
    const hasActiveCalls = Object.keys(remoteStreams).length > 0;

    if (participantCount === 1 && hasActiveCalls) {
      cleanup().then(() => {
        navigate('/chat', { state: { message: 'Call ended' } });
      });
    }
  }, [participants, remoteStreams, navigate]);

  const handleLeave = async () => {
    // Actively send an end_call signal to the other user so they exit immediately
    const otherpeerids = Object.keys(participants).filter(id => id !== userdata.uid);
    for (const peerid of otherpeerids) {
      await sendSignal({ type: 'end_call', from: userdata.uid, to: peerid });
    }
    
    await cleanup();
    navigate('/chat', { state: { message: 'Call ended' } });
  };

  const toggleMute = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
    });
    setIsMuted((prev) => !prev);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOff;
    });
    setIsCameraOff((prev) => !prev);
  };

  if (userdata === null) {
    return <div className="loading">Loading call...</div>;
  }

  if (!userdata?.avatar || !userdata?.username) {
    return <Navigate to="/profile" />;
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
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                   <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 100-6 3 3 0 000 6z"/><path fillRule="evenodd" d="M19.982 7.712a2 2 0 00-1.845-1.393H5.863a2 2 0 00-1.846 1.393L2 14.568V20a2 2 0 002 2h16a2 2 0 002-2v-5.432l-2.018-6.856zM18 10h-2V8h2v2zm-4 0h-4V8h4v2zM8 10H6V8h2v2z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <h3 className="m-0 text-xl font-bold text-white tracking-tight">{callType === 'audio' ? 'Fluid Audio Session' : 'Fluid Video Session'}</h3>
                  <p className="mt-1 text-xs text-blue-200/80 font-medium tracking-wide uppercase">{status}</p>
                </div>
              </div>
              <button 
                onClick={handleLeave}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 px-5 rounded-2xl transition-all duration-300 border border-white/10 shadow-sm flex items-center gap-2 hover:scale-105">
                Return to Chat
              </button>
            </div>

            <div className="flex-1 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] p-4 md:p-6 gap-4 md:gap-6 overflow-y-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black">
              {localStream && (
                <div className="rounded-[24px] overflow-hidden shadow-2xl border-4 border-slate-800 relative group aspect-[4/3] max-h-[300px] w-full">
                  <VideoTile stream={localStream} label="You" muted={true} />
                  {isMuted && <div className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg></div>}
                </div>
              )}
              {sortedRemoteIds.length === 0 ? (
                <div className="rounded-[24px] bg-slate-800/50 border-4 border-slate-800/80 flex flex-col items-center justify-center shadow-inner aspect-[4/3] max-h-[300px] w-full relative overflow-hidden">
                   <div className="w-20 h-20 bg-slate-700 rounded-full animate-ping absolute"></div>
                   <div className="w-20 h-20 bg-slate-600 rounded-full relative shadow-lg flex items-center justify-center text-3xl z-10 border border-slate-500">📞</div>
                   <p className="mt-6 text-slate-400 font-medium z-10 text-sm">{status === 'Connected' ? 'Waiting for participant to join...' : 'Establishing encrypted connection...'}</p>
                </div>
              ) : (
                sortedRemoteIds.map((peerId) => (
                  <div key={peerId} className="rounded-[24px] overflow-hidden shadow-2xl border-4 border-blue-500/30 relative group aspect-[4/3] max-h-[300px] w-full animate-in fade-in zoom-in duration-500">
                    <VideoTile stream={remoteStreams[peerId]} label={participants[peerId]?.username || 'Guest'} />
                  </div>
                ))
              )}
            </div>

            <div className="h-[90px] flex items-center justify-center gap-4 bg-black/40 backdrop-blur-lg border-t border-white/5 flex-shrink-0">
              <button 
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                {isMuted ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                )}
              </button>
              {callType === 'video' && (
                <button 
                  onClick={toggleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${isCameraOff ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}>
                  {isCameraOff ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3l18 18"></path></svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  )}
                </button>
              )}
              <button 
                onClick={handleLeave}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-[0_10px_25px_rgba(239,68,68,0.4)]">
                <svg className="w-8 h-8 transform rotate-135" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
              </button>
            </div>
          </div>
          
          <div className="hidden xl:block flex-shrink-0 w-[300px] h-full rounded-[28px] overflow-y-auto bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-100/80">
            <Rightsidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Call;