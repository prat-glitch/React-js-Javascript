import React, { useContext, useEffect, useState } from 'react';
import Sidebar from '../../components/sidebar/Sidebar';
import Chatbox from '../../components/chatbox/Chatbox';
import Rightsidebar from '../../components/rightsidebar/Rightsidebar';
import { Appcontext } from '../../context/Appcontext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

const Chat = () => {
  const { userdata, selectedChatUser } = useContext(Appcontext);
  const location = useLocation();
  const navigate = useNavigate();
  const [toastmessage, setToastmessage] = useState('');
  const [mobileView, setMobileView] = useState('sidebar'); // 'sidebar' | 'chat' | 'profile'

  useEffect(() => {
    if (location.state?.message) {
      setToastmessage(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (toastmessage) {
      const timer = setTimeout(() => setToastmessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastmessage]);

  useEffect(() => {
    if (selectedChatUser) setMobileView('chat');
  }, [selectedChatUser]);

  if (userdata === null) {
    return <div className="flex items-center justify-center min-h-screen font-medium text-slate-400">Loading FluidChat...</div>;
  }

  if (!userdata.avatar || !userdata.username) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden px-4 py-6 md:px-8 md:py-8 flex items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_35%,_#f1f5f9_70%,_#e2e8f0_100%)]">
      <div className="pointer-events-none absolute -top-32 -left-24 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(37,99,235,0.35),_rgba(59,130,246,0.05))] blur-3xl"></div>
      <div className="pointer-events-none absolute top-24 -right-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(16,185,129,0.25),_rgba(148,163,184,0.05))] blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-[-120px] left-1/3 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(99,102,241,0.18),_rgba(255,255,255,0))] blur-3xl"></div>

      {/* Toast message */}
      {toastmessage && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-[0_20px_60px_rgba(239,68,68,0.35)] z-[100] transition-all duration-300">
          {toastmessage}
        </div>
      )}

      {/* Main Container */}
      <div className="relative w-full h-[calc(100vh-3rem)] max-w-[1360px] max-h-[960px] rounded-[36px] bg-white/70 border border-white/70 shadow-[0_40px_120px_rgba(15,23,42,0.12)] backdrop-blur-2xl p-2 md:p-3">
        <div className="w-full h-full rounded-[30px] bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] flex overflow-hidden gap-4 md:gap-5">
          {/* Navigation Rail & Sidebar Column */}
          <div className={`
            flex-shrink-0 lg:flex h-full
            ${mobileView === 'sidebar' ? 'w-full flex' : 'hidden'} md:flex
            md:w-[320px] lg:w-[440px] xl:w-[480px]
            rounded-[28px] overflow-hidden bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-white/80
          `}>
            <Sidebar setMobileView={setMobileView} />
          </div>

          {/* Chat / Main Content Area */}
          <div className={`
            flex-1 h-full min-w-0 flex flex-col
            ${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex
            bg-white rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-100/80 relative
          `}>
            <Chatbox setMobileView={setMobileView} />
          </div>

          {/* Right Info Sidebar (Collapsible on smaller screens) */}
          <div className={`
            flex-shrink-0
            hidden lg:block
            lg:w-[300px] xl:w-[340px]
            h-full rounded-[28px] overflow-y-auto bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-100/80
          `}>
            <Rightsidebar setMobileView={setMobileView} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
