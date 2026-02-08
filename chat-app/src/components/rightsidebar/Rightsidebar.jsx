import React, { useContext } from 'react'
import './rightsidebar.css'
import assets from '../../assets/assets'
import { logout } from '../../config/firebase'
import { Appcontext } from '../../context/Appcontext'
import { useNavigate } from 'react-router-dom'

const Rightsidebar = () => {
  const { userdata } = useContext(Appcontext)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="rs">
      <div className="rs-profile">
        <img src={userdata?.avatar || assets.avatar_icon} alt="" />
        <h3>
          {userdata?.username || 'User'}
          <img src={assets.green_dot} className='dot' alt="" />
        </h3>
        <p>{userdata?.bio || ''}</p>
      </div>
      <hr />
      <div className="rs-info">
        <p><strong>Email:</strong> {userdata?.email}</p>
      </div>
      <hr />
      <button onClick={() => navigate('/profile')}>Edit Profile</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}

export default Rightsidebar