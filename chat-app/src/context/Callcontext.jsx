// src/context/CallContext.jsx
import React, { createContext, useContext, useRef, useState } from 'react'

export const CallContext = createContext()

export const CallProvider = ({ children }) => {
  const [activeCall, setActiveCall] = useState(null)
  // activeCall = { roomId, callType, localStream, remoteStreams, participants, status }

  const peerConnectionsRef = useRef(new Map())
  const localStreamRef = useRef(null)

  const startCall = (callData) => setActiveCall(callData)
  const endCall = () => {
    // stop tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    peerConnectionsRef.current.forEach(pc => pc.close())
    peerConnectionsRef.current.clear()
    setActiveCall(null)
  }

  return (
    <CallContext.Provider value={{ activeCall, setActiveCall, startCall, endCall, peerConnectionsRef, localStreamRef }}>
      {children}
    </CallContext.Provider>
  )
}

export const useCall = () => useContext(CallContext)