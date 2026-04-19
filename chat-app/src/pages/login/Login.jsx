import React, { useState } from 'react'
import assets from '../../assets/assets' 
import { signup, Login as loginUser } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const navigate = useNavigate();
  const [currstate, setcurrstate] = useState('Sign Up');
  const [username, setusername] = useState('');
  const [email, setemail] = useState('');
  const [password, setpassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onsubmithandler = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (currstate === "Sign Up") {
        const success = await signup(username, email, password);
        if (success) {
          navigate('/profile');
        }
      } else {
        const user = await loginUser(email, password);
        if (user) {
          // Navigated by Firebase Auth state listener in App.jsx
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden'>
      {/* Decorative Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>

      <div className="w-full max-w-[500px] fluid-card p-12 relative z-10 border border-white/10 backdrop-blur-3xl bg-white/95">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-blue-200 mb-6">
            <img src={assets.logo_icon} alt='logo' className='w-10 h-10 brightness-[10]' />
          </div>
          <h2 className='text-3xl font-extrabold text-slate-800 tracking-tight'>{currstate}</h2>
          <p className="text-slate-400 mt-2 font-medium">Fluidity in every interaction</p>
        </div>

        <form onSubmit={onsubmithandler} className='flex flex-col gap-6'>
          {currstate === "Sign Up" && (
            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none transition-colors">
                <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </div>
                <input
                  onChange={(e) => setusername(e.target.value)}
                  value={username}
                  type="text"
                  placeholder='Full Name'
                  className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[2rem] outline-none transition-all focus:border-blue-100 focus:bg-white text-slate-700"
                  required
                />
            </div>
          )}

          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
            <input
              onChange={(e) => setemail(e.target.value)}
              value={email}
              type="email"
              placeholder='Email Address'
              className="w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[2rem] outline-none transition-all focus:border-blue-100 focus:bg-white text-slate-700"
              required
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <svg className="w-5 h-5 text-slate-400 group-focus-within:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <input
              onChange={(e) => setpassword(e.target.value)}
              value={password}
              type="password"
              placeholder="Password"
              className='w-full pl-16 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[2rem] outline-none transition-all focus:border-blue-100 focus:bg-white text-slate-700'
              required
            />
          </div>

          <button 
            type='submit' 
            disabled={loading}
            className='h-14 bg-blue-600 text-white font-extrabold rounded-[2rem] shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:bg-slate-300 disabled:shadow-none'
          >
            {loading ? 'Processing...' : (currstate === "Sign Up" ? "Establish Account" : "Access Secret Chat")}
          </button>

          <div className="flex gap-3 text-xs text-slate-400 items-center justify-center">
            <input type='checkbox' className="rounded text-blue-600 focus:ring-blue-100" />
            <p>I agree to the Fluid Terms & Conditions.</p>
          </div>

          <div className='flex flex-col items-center mt-4'>
            {currstate === "Sign Up" ? (
              <p className="text-sm text-slate-500">
                Already part of the flow?{" "}
                <span className='text-blue-600 font-bold cursor-pointer hover:underline' onClick={() => setcurrstate('Login')}>Login here</span>
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                New to the exchange?{" "}
                <span className='text-blue-600 font-bold cursor-pointer hover:underline' onClick={() => setcurrstate('Sign Up')}>Click here</span>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
