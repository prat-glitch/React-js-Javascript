import React, { useContext, useEffect, useState } from 'react';
import Sidebar from '../../components/sidebar/Sidebar';
import Chatbox from '../../components/chatbox/Chatbox';
import Rightsidebar from '../../components/rightsidebar/Rightsidebar';
import { Appcontext } from '../../context/Appcontext';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Audiocallbar from '../../components/calls/Audiocallbar';


const Chat = () => {
  const { userdata, selectedChatUser } = useContext(Appcontext);
  const location = useLocation();
  const navigate = useNavigate();
  const [toastmessage, setToastmessage] = useState('');
  const [mobileView, setMobileView] = useState('sidebar'); // 'sidebar' | 'chat' | 'profile'
  const [showContactInfo, setShowContactInfo] = useState(false);

  useEffect(() => {
    if (location.state?.message) {
      setToastmessage(location.state.message);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // On mobile viewports, always start on the sidebar (chat list) regardless
  // of any previously selected chat user (e.g., after a PWA launch / page refresh).
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      setMobileView('sidebar');
    }
  }, []); // runs only once on mount

  useEffect(() => {
    if (toastmessage) {
      const timer = setTimeout(() => setToastmessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastmessage]);

  useEffect(() => {
    if (selectedChatUser) setMobileView('chat');
    // Reset panel when chat changes
    setShowContactInfo(false);
  }, [selectedChatUser]);

  if (userdata === null) {
    return <div className="flex items-center justify-center min-h-screen font-medium text-slate-400">Loading Samlap...</div>;
  }

  if (!userdata.avatar || !userdata.username) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_top,_#eef2ff,_#f8fafc_35%,_#f1f5f9_70%,_#e2e8f0_100%)] dark:bg-none dark:bg-[#0b141a]">
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
      <div className="relative w-full h-[100dvh] md:h-[calc(100vh-3rem)] max-w-[1200px] md:max-h-[960px] md:rounded-[36px] bg-white/70 md:border md:border-white/70 shadow-[0_40px_120px_rgba(15,23,42,0.12)] backdrop-blur-2xl p-0 md:p-3 dark:bg-transparent dark:md:border-transparent dark:shadow-none dark:backdrop-blur-none">
        <div className="w-full h-full md:rounded-[30px] bg-white md:bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] flex overflow-hidden gap-0 md:gap-5 dark:bg-transparent dark:shadow-none">
          {/* Navigation Rail & Sidebar Column */}
          <div className={`
            flex-shrink-0 lg:flex h-full
            ${mobileView === 'sidebar' ? 'w-full flex' : 'hidden'} md:flex
            md:w-[320px] lg:w-[380px]
            md:rounded-[28px] overflow-hidden bg-white md:shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:border md:border-white/80 dark:bg-[#111b21] dark:md:shadow-none dark:md:border-[#202c33]
          `}>
            <Sidebar setMobileView={setMobileView} />
          </div>

          {/* Chat / Main Content Area */}
          <div className={`
            flex-1 h-full min-w-0 flex flex-col
            ${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex
            bg-white md:rounded-[28px] overflow-hidden md:shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:border md:border-slate-100/80 relative dark:bg-[#0b141a] dark:md:shadow-none dark:md:border-[#202c33]
          `}>
            <Chatbox setMobileView={setMobileView} setShowContactInfo={setShowContactInfo} />
          </div>

          {/* Right Info Sidebar (desktop column) */}
          {showContactInfo && (
            <div className={`
              flex-shrink-0 relative
              hidden lg:block
              lg:w-[300px] xl:w-[340px]
              h-full rounded-[28px] overflow-hidden bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-100/80 dark:bg-[#111b21] dark:shadow-none dark:border-[#202c33]
              transition-all duration-300
            `}>
              <Rightsidebar
                showContactInfo={showContactInfo}
                setShowContactInfo={setShowContactInfo}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile contact info modal (WhatsApp-style overlay) */}
      {showContactInfo && (
      <div className="lg:hidden fixed inset-0 z-[200] bg-white dark:bg-[#111b21]" style={{ animation: 'slideInRight 0.22s ease' }}>
          <Rightsidebar
            showContactInfo={showContactInfo}
            setShowContactInfo={setShowContactInfo}
          />
        </div>
      )}
    </div>
  );
};

export default Chat;

