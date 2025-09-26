import React, { useContext, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/login/Login.jsx';
import Chat from './pages/chat/Chat.jsx';
import Profile from './pages/profileupdate/Profile.jsx';
import { ToastContainer } from 'react-toastify';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase.js';
import { Appcontext } from './context/Appcontext.jsx';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loaduserdata } = useContext(Appcontext);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("✅ Firebase user logged in:", user);
        await loaduserdata(user.uid);

        // ✅ If user is on login page, redirect to chat
        if (location.pathname === "/") {
          navigate("/chat");
        }
      } else {
        // ✅ If not logged in, stay on login page or redirect to login
        if (location.pathname !== "/") {
          navigate("/");
        }
      }
    }); 

    return () => unsubscribe();
  }, []);

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </>
  );
};

export default App;
