import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, addDoc } from 'firebase/firestore';
import Leftsidebar from '../../components/leftsidebar/Leftsidebar';
import Rightsidebar from '../../components/rightsidebar/Rightsidebar';
import { Appcontext } from '../../context/Appcontext';
import { db } from '../../config/firebase';
import './call.css';

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
    <div className="call-tile">
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      <span className="call-label">{label}</span>
    </div>
  );
};

const Call = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userdata } = useContext(Appcontext);

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
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
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

    if (!peerConnectionsRef.current.has(peerId)) {
      await ensurePeerConnection(peerId, false);
    }

    const pc = peerConnectionsRef.current.get(peerId);
    if (!pc) return;

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
      queued.forEach(async (candidate) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      });
      pendingCandidatesRef.current.delete(peerId);
    }

    if (data.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }

    if (data.type === 'candidate') {
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {}
      } else {
        const existing = pendingCandidatesRef.current.get(peerId) || [];
        pendingCandidatesRef.current.set(peerId, [...existing, data.candidate]);
      }
    }

    await deleteDoc(signalDoc.ref);
  };

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
        if (change.type !== 'added') return;
        const peerId = change.doc.id;
        if (peerId === userdata.uid) return;

        const initiator = userdata.uid < peerId;
        ensurePeerConnection(peerId, initiator);
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

  const handleLeave = async () => {
    await cleanup();
    navigate('/chat');
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
    <div className="chat">
      <div className="chat-container">
        <Leftsidebar />
        <div className="call-center">
          <div className="call-header">
            <div>
              <h3>{callType === 'audio' ? 'Audio call' : 'Video call'}</h3>
              <p className="call-status">{status}</p>
            </div>
            <button className="call-back" onClick={handleLeave}>Back to chat</button>
          </div>

          <div className="call-grid">
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

          <div className="call-controls">
            <button className="call-control" onClick={toggleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            {callType === 'video' && (
              <button className="call-control" onClick={toggleCamera}>
                {isCameraOff ? 'Camera on' : 'Camera off'}
              </button>
            )}
            <button className="call-control danger" onClick={handleLeave}>End call</button>
          </div>
        </div>
        <Rightsidebar />
      </div>
    </div>
  );
};

export default Call;
