import React, { useState, useContext, useEffect } from 'react';
import { Appcontext } from '../../context/Appcontext';
import { isPushSupported, subscribeToPush, getNotificationPermission } from '../../lib/pushNotifications';

const PushPermissionBanner = () => {
  const { userdata } = useContext(Appcontext);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userdata?.uid) return;
    if (!isPushSupported()) return;
    if (getNotificationPermission() !== 'default') return;
    if (localStorage.getItem('push-banner-dismissed') === 'true') return;
    setVisible(true);
  }, [userdata?.uid]);

  const handleEnable = async () => {
    await subscribeToPush(userdata.uid);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('push-banner-dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-[#1a2734] border border-slate-200 dark:border-[#2a3942] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Bell icon */}
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Enable notifications</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Get notified when you receive new messages</p>
        </div>

        <button
          onClick={handleEnable}
          className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 dark:bg-indigo-500 rounded-xl hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all flex-shrink-0"
        >
          Enable
        </button>

        <button
          onClick={handleDismiss}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PushPermissionBanner;
