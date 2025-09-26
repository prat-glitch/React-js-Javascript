import React from 'react'
import './rightsidebar.css'
import assets from '../../assets/assets'
import { logout } from '../../config/firebase'
const Rightsidebar = () => {
  return (
    <div className="rs">
      <div className="rs-profile">
        <img src={assets.profile_img} alt="" />
        <h3>Pratyush <img src={assets.green_dot}className='dot' alt="" /></h3>
        <p>I'm a boy</p>
      </div>
      <hr />
      <div className="rs-media">
        <p>Media</p>
        <div>
          <img src={assets.pic1} alt="" />
          <img src={assets.pic2} alt="" />
          <img src={assets.pic3} alt="" />
          <img src={assets.pic4} alt="" />
          <img src={assets.pic1} alt="" />
          <img src={assets.pic2} alt="" />
        </div>
      </div>
      <button onClick={() =>logout()}>Logout</button>
    </div>
  )
}

export default Rightsidebar