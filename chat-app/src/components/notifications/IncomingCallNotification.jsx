import React, { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appcontext } from '../../context/Appcontext';
import { getSupabase } from '../../config/supabase';

const IncomingCallNotification = () => {
  const { userdata } = useContext(Appcontext);
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userdata?.uid) return;

    // Listen on a personal channel for this user
    const channel = getSupabase().channel(`user:${userdata.uid}`);

    channel.on('broadcast', { event: 'call:incoming' }, (payload) => {
      console.log('Incoming call data:', payload);
      setIncomingCall(payload.payload);
    });

    channel.on('broadcast', { event: 'call:rejected' }, () => {
      setIncomingCall(null);
    });
    
    channel.on('broadcast', { event: 'call:cancelled' }, () => {
      setIncomingCall(null);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [userdata?.uid]);

  const handleAccept = () => {
    if (!incomingCall) return;
    navigate(`/call/${incomingCall.chatId}?type=${incomingCall.callType}&role=callee`);
    setIncomingCall(null);
  };

  const handleReject = () => {
    if (!incomingCall) return;
    
    // Notify the caller that it was rejected
    if (incomingCall.callerId) {
      getSupabase().channel(`user:${incomingCall.callerId}`).send({
        type: 'broadcast',
        event: 'call:rejected',
        payload: { calleeId: userdata.uid }
      });
    }

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
