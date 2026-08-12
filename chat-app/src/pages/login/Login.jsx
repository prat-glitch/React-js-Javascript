import React, { useState, useContext } from 'react'
import { signup, Login as loginUser, googleSignIn } from '../../config/firebase'
import { Appcontext } from '../../context/Appcontext'

/* ─── Google "G" Logo SVG ─────────────────────────────────────── */
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

/* ─── Eye / Eye-off icons ─────────────────────────────────────── */
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

/* ─── Spinner ─────────────────────────────────────────────────── */
const Spinner = () => (
  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
  </svg>
)

/* ═══════════════════════════════════════════════════════════════ */

const Login = () => {
  const { loaduserdata } = useContext(Appcontext)

  const [currstate, setcurrstate]   = useState('Login')
  const [username, setusername]     = useState('')
  const [email, setemail]           = useState('')
  const [password, setpassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  /* ── handlers ── */
  const onsubmithandler = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (currstate === 'Sign Up') {
        await signup(username, email, password)
      } else {
        await loginUser(email, password)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      await googleSignIn()
    } finally {
      setGoogleLoading(false)
    }
  }

  const switchState = () => {
    setcurrstate(currstate === 'Login' ? 'Sign Up' : 'Login')
    setusername('')
    setemail('')
    setpassword('')
  }

  /* ── helpers ── */
  const isLogin  = currstate === 'Login'
  const anyBusy  = loading || googleLoading

  return (
    /* ── Outer background ── */
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#eef0fb] dark:bg-[#0b141a]">
      {/* ── Card ── */}
      <div
        className="w-full bg-white dark:bg-[#111b21] flex flex-col shadow-[0_4px_24px_0_rgba(60,70,130,0.07)] dark:shadow-none border border-[#e2e4ef] dark:border-[#202c33] rounded-[16px] max-w-[400px] p-[36px_36px_32px]"
      >
        {/* ── Brand name ── */}
        <p className="text-center font-semibold mb-1 text-blue-600 dark:text-emerald-400 text-[15px] tracking-[-0.01em]">
          Samlap
        </p>

        {/* ── Heading ── */}
        <h1 className="text-center font-bold text-[#0f1117] dark:text-white text-[26px] leading-[1.2] mb-[6px]">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>

        {/* ── Subheading ── */}
        <p className="text-center text-[#9298ab] dark:text-slate-400 text-[13.5px] mb-6">
          {isLogin
            ? 'Please enter your details to sign in'
            : 'Fill in the details below to get started'}
        </p>

        {/* ── Google button ── */}
        <button
          id="google-signin-btn"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={anyBusy}
          className={`w-full flex items-center justify-center gap-2 font-medium transition-all h-[44px] border-[1.5px] border-[#d1d5e0] dark:border-[#202c33] rounded-lg bg-white dark:bg-[#202c33] text-[#1a1d27] dark:text-white text-[14px] mb-5 ${anyBusy ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-[#2a3942]"}`}
        >
          {googleLoading
            ? <><Spinner /> Connecting…</>
            : <><GoogleIcon /> Continue with Google</>
          }
        </button>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#e2e4ef] dark:bg-[#202c33]" />
          <span className="text-[#9298ab] dark:text-slate-500 text-[11px] tracking-[0.07em] font-medium">
            OR CONTINUE WITH EMAIL
          </span>
          <div className="flex-1 h-px bg-[#e2e4ef] dark:bg-[#202c33]" />
        </div>

        {/* ── Form ── */}
        <form onSubmit={onsubmithandler} className="flex flex-col gap-4">

          {/* Full Name — sign-up only */}
          {!isLogin && (
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="username" className="text-[13.5px] font-medium text-[#374151] dark:text-slate-300">
                Full Name
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setusername(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full h-[44px] px-[14px] border-[1.5px] border-[#d1d5e0] dark:border-[#202c33] rounded-lg bg-white dark:bg-[#202c33] text-[14px] text-[#1a1d27] dark:text-white outline-none transition-all focus:border-blue-600 dark:focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] dark:focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] placeholder-[#9298ab] dark:placeholder-slate-500"
              />
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-[6px]">
            <label htmlFor="email" className="text-[13.5px] font-medium text-[#374151] dark:text-slate-300">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setemail(e.target.value)}
              placeholder="name@company.com"
              required
              className="w-full h-[44px] px-[14px] border-[1.5px] border-[#d1d5e0] dark:border-[#202c33] rounded-lg bg-white dark:bg-[#202c33] text-[14px] text-[#1a1d27] dark:text-white outline-none transition-all focus:border-blue-600 dark:focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] dark:focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] placeholder-[#9298ab] dark:placeholder-slate-500"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[13.5px] font-medium text-[#374151] dark:text-slate-300">
                Password
              </label>
              {isLogin && (
                <a href="#" className="text-[13px] text-blue-600 dark:text-emerald-400 font-medium no-underline hover:underline">
                  Forgot password?
                </a>
              )}
            </div>

            {/* Password wrapper */}
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setpassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-[44px] pl-[14px] pr-[44px] border-[1.5px] border-[#d1d5e0] dark:border-[#202c33] rounded-lg bg-white dark:bg-[#202c33] text-[14px] text-[#1a1d27] dark:text-white outline-none transition-all focus:border-blue-600 dark:focus:border-emerald-500 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] dark:focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] placeholder-[#9298ab] dark:placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute',
                  right: 13,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9298ab',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Remember / Terms */}
          {isLogin ? (
            <label className="flex items-center gap-2 text-[13.5px] text-[#374151] dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-[15px] h-[15px] rounded border-[1.5px] border-[#d1d5e0] dark:border-[#202c33] cursor-pointer accent-blue-600 dark:accent-emerald-500 shrink-0"
              />
              Remember for 30 days
            </label>
          ) : (
            <label className="flex items-center gap-2 text-[13.5px] text-[#374151] dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                id="terms"
                required
                className="w-[15px] h-[15px] rounded border-[1.5px] border-[#d1d5e0] dark:border-[#202c33] cursor-pointer accent-blue-600 dark:accent-emerald-500 shrink-0"
              />
              I agree to the Terms &amp; Conditions
            </label>
          )}

          {/* Submit */}
          <button
            id="email-submit-btn"
            type="submit"
            disabled={anyBusy}
            className={`w-full font-semibold text-white flex items-center justify-center gap-2 transition-all h-[46px] rounded-lg text-[15px] tracking-[0.01em] mt-[2px] ${anyBusy ? "bg-[#4f6ae0] dark:bg-emerald-700 cursor-not-allowed" : "bg-blue-600 dark:bg-emerald-600 hover:bg-blue-700 dark:hover:bg-emerald-700 cursor-pointer"}`}
          >
            {loading
              ? <><Spinner /> Processing…</>
              : (isLogin ? 'Log In' : 'Sign Up')
            }
          </button>
        </form>

        {/* ── Footer link ── */}
        <p className="text-center text-[13.5px] text-[#6b7280] dark:text-slate-400 mt-6">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={switchState}
            className="bg-transparent border-none p-0 text-blue-600 dark:text-emerald-400 font-semibold cursor-pointer text-[13.5px] hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </div>
    </div>
  )
}

/* ─── Shared input style objects ──────────────────────────────── */
const inputStyle = {
  width: '100%',
  height: 44,
  border: '1.5px solid #d1d5e0',
  borderRadius: 8,
  padding: '0 14px',
  fontSize: 14,
  color: '#1a1d27',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const inputFocusStyle = {
  borderColor: '#2563eb',
  boxShadow: '0 0 0 3px rgba(37,99,235,0.12)',
}

const inputBlurStyle = {
  borderColor: '#d1d5e0',
  boxShadow: 'none',
}

const checkboxStyle = {
  width: 15,
  height: 15,
  borderRadius: 4,
  border: '1.5px solid #d1d5e0',
  cursor: 'pointer',
  accentColor: '#2563eb',
  flexShrink: 0,
}

export default Login
