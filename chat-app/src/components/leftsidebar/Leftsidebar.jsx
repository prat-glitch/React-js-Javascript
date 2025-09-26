import React from 'react'
import './leftsidebar.css'
import assets from '../../assets/assets'
const Leftsidebar = () => {
  return (
    <div className='ls'>
        <div className='ls-top'>
            <div className='ls-nav'>
                <img src= {assets.logo} className='logo' alt=''/>
                <div className='menu'>
                    <img src={assets.menu_icon} alt='' />
                    <div className="submenu">
                      <p>Edit Profile</p>
                      <hr />
                      <p>Logout</p>
                    </div>
                </div>
            </div>
        <div className='ls-search'>
          <img src={assets.search_icon} alt=''/>
          <input type='text' placeholder='Search or start new chat'/>
        </div>
        </div>
        <div className='ls-list'>
  {Array(12).fill("").map((item, index) => {
    return (  
      <div key={index} className='freinds'>
        <img src={assets.profile_img} alt=''/>
        <div>
          <p>Momo</p>
          <span>Hello , Popo !</span>
        </div>
      </div>
    );
  })}
</div>
    </div>
  )
}

export default Leftsidebar