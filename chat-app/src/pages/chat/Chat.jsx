import React, { useContext, useEffect, useState } from 'react';
import Leftsidebar from '../../components/leftsidebar/Leftsidebar';
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
    return <Navigate to="/profile" />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-[#f5f7fb] p-0 md:p-4 lg:p-6">
      
      {/* Toast message */}
      {toastmessage && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-xl z-[100] transition-all duration-300">
          {toastmessage}
        </div>
      )}

      {/* Main Container */}
      <div className="w-full h-full max-w-[1440px] max-h-[900px] bg-white rounded-none md:rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.1)] flex overflow-hidden border border-slate-100">
        
        {/* Navigation Rail & Sidebar Column */}
        <div className={`
          flex-shrink-0 lg:flex h-full
          ${mobileView === 'sidebar' ? 'w-full flex' : 'hidden'} md:flex
          md:w-[320px] lg:w-[440px] xl:w-[480px]
        `}>
          <Leftsidebar setMobileView={setMobileView} />
        </div>

        {/* Chat / Main Content Area */}
        <div className={`
          flex-1 h-full min-w-0 flex flex-col
          ${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex
          bg-white border-l border-[#f4f6fa] relative
        `}>
          <Chatbox setMobileView={setMobileView} />
        </div>

        {/* Right Info Sidebar (Collapsible on smaller screens) */}
        <div className={`
          flex-shrink-0
          hidden lg:block
          lg:w-[300px] xl:w-[340px]
          h-full border-l border-slate-50 overflow-y-auto
        `}>
          <Rightsidebar setMobileView={setMobileView} />
        </div>

      </div>
    </div>
  );
};

export default Chat;
