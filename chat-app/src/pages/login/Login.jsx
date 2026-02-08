import React, { useState } from 'react'
import './login.css'
import assets from '../../assets/assets' 
import { signup, Login as loginUser } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const navigate = useNavigate();
  const [currstate, setcurrstate] = useState('Sign Up');
  const [username, setusername] = useState('');
  const [email, setemail] = useState('');
  const [password, setpassword] = useState('');

  const onsubmithandler = async (event) => {
    event.preventDefault();
    if (currstate === "Sign Up") {
      const success = await signup(username, email, password);
      if (success) {
        navigate('/profile');
      }
    } else {
      const user = await loginUser(email, password);
      if (user) {
        // Context will handle redirect based on profile completion
      }
    }
  }

  return (
    <div className='login'>
      <img src={assets.logo_big} alt='' className='logo' />
      <form onSubmit={onsubmithandler} className='login-form'>
        <h2>{currstate}</h2>
        {currstate === "Sign Up" && (
          <input
            onChange={(e) => setusername(e.target.value)}
            value={username}
            type="text"
            placeholder='Username'
            className="form-input"
            required
          />
        )}
        <br />

        <input
          onChange={(e) => setemail(e.target.value)}
          value={email}
          type="email"
          placeholder='Email Address'
          className="form-input"
          required
        />
        <br />

        <input
          onChange={(e) => setpassword(e.target.value)}
          value={password}
          type="password"
          placeholder="Password"
          className='form-input'
          required
        />
        <br />

        <button type='submit'>
          {currstate === "Sign Up" ? "Create Account" : "Login Now"}
        </button>

        <div className="login-term">
          <input type='checkbox' />
          <p>Agree to the terms of use & privacy policy.</p>
        </div>

        <div className='login-forgot'>
          {currstate === "Sign Up" ? (
            <p className="login-toggle">
              Already have an account?{" "}
              <span onClick={() => setcurrstate('Login')}>Login here</span>
            </p>
          ) : (
            <p className="login-toggle">
              Create an account{" "}
              <span onClick={() => setcurrstate('Sign Up')}>Click here</span>
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

export default Login
