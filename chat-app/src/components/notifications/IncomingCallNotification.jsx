import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';

const IncomingCallNotification = () => {
  const { socket, isConnected, rejectCall } = useSocket();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleCallIncoming = (data) => {
      console.log('Incoming call data:', data);
      // data: { callerId, callerName, chatId, callType }
      setIncomingCall(data);
      
      // Optional: Play a ringing sound here
      // const audio = new Audio('/ringtone.mp3');
      // audio.play();
    };

    const handleCallRejected = () => {
      setIncomingCall(null);
    };

    socket.on('call:incoming', handleCallIncoming);
    socket.on('call:rejected', handleCallRejected);

    return () => {
      socket.off('call:incoming', handleCallIncoming);
      socket.off('call:rejected', handleCallRejected);
    };
  }, [socket, isConnected]);

  const handleAccept = () => {
    if (!incomingCall) return;
    navigate(`/call/${incomingCall.chatId}?type=${incomingCall.callType}&role=callee`);
    setIncomingCall(null);
  };

  const handleReject = () => {
    if (!incomingCall) return;
    rejectCall(incomingCall.callerId);
    setIncomingCall(null);
  };

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#100531] p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 min-w-[300px] border border-white/10 scale-100 transition-transform duration-300">
        <div className="relative">
          <div className="w-20 h-20 bg-[#002670] rounded-full flex items-center justify-center animate-pulse">
            <span className="text-4xl">📞</span>
          </div>
        </div>
        
        <div className="text-center">
          <h3 className="text-white text-xl font-semibold m-0">{incomingCall.callerName}</h3>
          <p className="text-white/70 mt-1">
            Incoming {incomingCall.callType === 'video' ? 'Video' : 'Audio'} Call...
          </p>
        </div>

        <div className="flex gap-4 w-full mt-4">
          <button 
            onClick={handleReject}
            className="flex-1 py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
          >
            Decline
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 py-3 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors animate-pulse"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;
