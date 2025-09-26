import React, { useContext } from 'react';
import './chat.css';
import Leftsidebar from '../../components/leftsidebar/Leftsidebar';
import Chatbox from '../../components/chatbox/Chatbox';
import Rightsidebar from '../../components/rightsidebar/Rightsidebar';
import { Appcontext } from '../../context/Appcontext';
import { Navigate } from 'react-router-dom';

const Chat = () => {
  const { userdata } = useContext(Appcontext);

  // 🔄 Loading state while user data is being fetched
  if (userdata === null) {
    return <div className="loading">Loading chat...</div>;
  }

  // ❌ Redirect if profile is incomplete
  if (!userdata.avatar || !userdata.username) {
    return <Navigate to="/profile" />;
  }

  // ✅ Show chat page if profile is complete
  return (
    <div className="chat">
      <div className="chat-container">
        <Leftsidebar />
        <Chatbox />
        <Rightsidebar />
      </div>
    </div>
  );
};

export default Chat;
