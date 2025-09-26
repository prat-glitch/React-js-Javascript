import React, { useState, useEffect } from 'react'
import './chatbox.css'
import assets from '../../assets/assets'

const Chatbox = () => {
  const [time, setTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 60000) // update every minute

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="chatbox">
      {/* Chat User Header */}
      <div className="chat-user">
        <img src={assets.profile_img} alt="Profile" />
        <p>
          Sam <img className="dot" src={assets.green_dot} alt="Online" /> 
          <span className="time">{time}</span>
        </p>
        <img src={assets.help_icon} className="help" alt="Help" />
      </div>

      {/* Chat Messages */}
      <div className="chat-message">
        <div className="s-msg">
          <p className="msg">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed, laboriosam doloribus 
            reiciendis totam assumenda corporis, quas, animi hic voluptate ab esse ad culpa.
          </p>
          <div className="msg-footer">
            <img src={assets.profile_img} alt="Sender" />
            <p className="time">{time}</p>
          </div>
        </div>
        <div className="s-msg">
          <img className='msg-img' src={assets.pic1} alt="" />
        </div>
        <div className="r-msg">
          <p className="msg">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Sed, laboriosam doloribus 
            reiciendis totam assumenda corporis, quas, animi hic voluptate ab esse ad culpa.
          </p>
          <div className="msg-footer">
            <img src={assets.profile_img} alt="Sender" />
            <p className="time">{time}</p>
          </div>
        </div>
      </div>

      {/* Chat Input */}
      <div className="chat-input">
        <input type="text" placeholder="Type a message..." />
        <input type="file" id="image" accept="image/png,image/jpeg" hidden />
        <label htmlFor="image">
          <img src={assets.gallery_icon} alt="Gallery" />
        </label>
        <img src={assets.send_button} alt="Send" />
      </div>
    </div>
  )
}

export default Chatbox
