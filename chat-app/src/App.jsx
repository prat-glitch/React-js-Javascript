import React, { useContext, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/login/Login.jsx';
import Chat from './pages/chat/Chat.jsx';
import Profile from './pages/profileupdate/Profile.jsx';
import Call from './pages/call/Call.jsx';
import { ToastContainer } from 'react-toastify';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase.js';
import { Appcontext } from './context/Appcontext.jsx';
import IncomingCallNotification from './components/notifications/IncomingCallNotification.jsx';
import PushPermissionBanner from './components/notifications/PushPermissionBanner.jsx';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loaduserdata } = useContext(Appcontext);

  return (
    <>
      <ToastContainer />
      <IncomingCallNotification />
      <PushPermissionBanner />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/call/:roomId" element={<Call />} />
      </Routes>
    </>
  );
};

export default App;
