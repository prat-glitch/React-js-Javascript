import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, addDoc } from 'firebase/firestore';
import { Appcontext } from '../../context/Appcontext';
import { useSocket } from '../../context/SocketContext';
import { db } from '../../config/firebase';
import Leftsidebar from '../../components/leftsidebar/Leftsidebar';
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
    <div className="min-h-screen bg-gradient-to-b from-[#327ec9] to-[#052449] grid place-items-center py-4">
      <div className="w-[min(95%,1200px)] h-[86vh] min-h-[520px] md:h-[75vh] lg:h-[72vh] md:min-h-[480px] bg-[#f0f8ff] grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)_minmax(240px,1fr)] rounded-[14px] overflow-hidden relative shadow-[0_18px_40px_rgba(2,12,27,0.25)]">
        <Leftsidebar />
        <div className="h-full w-full min-h-0 flex flex-col bg-[#0b2340] text-white border-x border-[#0f2d50]">
          <div className="flex items-center justify-between py-3 px-4 border-b border-[#0f2d50] bg-[#0d2a4d]">
            <div>
              <h3 className="m-0 text-lg font-semibold">{callType === 'audio' ? 'Audio call' : 'Video call'}</h3>
              <p className="mt-1 text-xs text-[#c7d7f5]">{status}</p>
            </div>
            <button className="border-none bg-[#1f7aec] text-white py-2 px-3 rounded-2xl cursor-pointer text-xs hover:bg-[#1867c9]" onClick={handleLeave}>Back to chat</button>
          </div>

          <div className="flex-1 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 p-3 overflow-y-auto">
            {localStream && (
              <VideoTile
                stream={localStream}
                label="You"
                muted={true}
              />
            )}
            {sortedRemoteIds.map((peerId) => (
              <VideoTile
                key={peerId}
                stream={remoteStreams[peerId]}
                label={participants[peerId]?.username || 'Guest'}
              />
            ))}
          </div>

          <div className="flex justify-center gap-2.5 p-3 bg-[#0d2a4d] border-t border-[#0f2d50]">
            <button className="border-none bg-[#1f7aec] text-white py-2 px-3.5 rounded-2xl cursor-pointer text-xs hover:bg-[#1867c9]" onClick={toggleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            {callType === 'video' && (
              <button className="border-none bg-[#1f7aec] text-white py-2 px-3.5 rounded-2xl cursor-pointer text-xs hover:bg-[#1867c9]" onClick={toggleCamera}>
                {isCameraOff ? 'Camera on' : 'Camera off'}
              </button>
            )}
            <button className="border-none bg-[#ff4757] text-white py-2 px-3.5 rounded-2xl cursor-pointer text-xs hover:bg-[#ff3344]" onClick={handleLeave}>End call</button>
          </div>
        </div>
        <Rightsidebar />
      </div>
    </div>
  );
};

export default Call;