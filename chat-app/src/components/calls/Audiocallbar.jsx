// src/components/calls/Audiocallbar.jsx
import React, { useEffect, useState } from 'react'

const AudioCallBar = () => {
  const [isActive, setIsActive] = useState(false)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const checkState = () => {
      const type = sessionStorage.getItem('callType');
      const start = sessionStorage.getItem('callStartTime');
      
      if (type === 'audio' && start) {
        setIsActive(true);
        setSeconds(Math.floor((Date.now() - parseInt(start)) / 1000));
      } else {
        setIsActive(false);
      }
    };

    checkState();
    const timer = setInterval(checkState, 1000);
    return () => clearInterval(timer);
  }, [])

  if (!isActive) return null

  const format = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const handleReturn = () => {
    window.dispatchEvent(new CustomEvent('maximize-call'));
  };

  return (
    <div 
      onClick={handleReturn}
      className="bg-emerald-50 cursor-pointer text-emerald-700 px-4 py-1.5 rounded-full flex items-center justify-between text-xs font-bold border border-emerald-200 shadow-sm gap-4 min-w-[180px] hover:bg-emerald-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span>In Audio Call</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono bg-emerald-100/50 px-2 py-0.5 rounded-md">{format(seconds)}</span>
      </div>
    </div>
  )
}

export default AudioCallBar