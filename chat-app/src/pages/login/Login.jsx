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
    <div style={{ background: '#eef0fb' }}
      className="min-h-screen flex items-center justify-center p-4"
    >
      {/* ── Card ── */}
      <div
        className="w-full bg-white flex flex-col"
        style={{
          maxWidth: 400,
          borderRadius: 16,
          border: '1px solid #e2e4ef',
          boxShadow: '0 4px 24px 0 rgba(60,70,130,0.07)',
          padding: '36px 36px 32px',
        }}
      >
        {/* ── Brand name ── */}
        <p
          className="text-center font-semibold mb-1"
          style={{ color: '#2563eb', fontSize: 15, letterSpacing: '-0.01em' }}
        >
          ChitChat
        </p>

        {/* ── Heading ── */}
        <h1
          className="text-center font-bold"
          style={{ color: '#0f1117', fontSize: 26, lineHeight: 1.2, marginBottom: 6 }}
        >
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>

        {/* ── Subheading ── */}
        <p
          className="text-center"
          style={{ color: '#9298ab', fontSize: 13.5, marginBottom: 24 }}
        >
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
          className="w-full flex items-center justify-center gap-2 font-medium transition-all"
          style={{
            height: 44,
            border: '1.5px solid #d1d5e0',
            borderRadius: 8,
            background: '#fff',
            color: '#1a1d27',
            fontSize: 14,
            cursor: anyBusy ? 'not-allowed' : 'pointer',
            opacity: anyBusy ? 0.7 : 1,
            marginBottom: 20,
          }}
        >
          {googleLoading
            ? <><Spinner /> Connecting…</>
            : <><GoogleIcon /> Continue with Google</>
          }
        </button>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#e2e4ef' }} />
          <span style={{ color: '#9298ab', fontSize: 11, letterSpacing: '0.07em', fontWeight: 500 }}>
            OR CONTINUE WITH EMAIL
          </span>
          <div style={{ flex: 1, height: 1, background: '#e2e4ef' }} />
        </div>

        {/* ── Form ── */}
        <form onSubmit={onsubmithandler} className="flex flex-col" style={{ gap: 16 }}>

          {/* Full Name — sign-up only */}
          {!isLogin && (
            <div className="flex flex-col" style={{ gap: 6 }}>
              <label
                htmlFor="username"
                style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}
              >
                Full Name
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setusername(e.target.value)}
                placeholder="John Doe"
                required
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e  => Object.assign(e.target.style, inputBlurStyle)}
              />
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="email"
              style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setemail(e.target.value)}
              placeholder="name@company.com"
              required
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={e  => Object.assign(e.target.style, inputBlurStyle)}
            />
          </div>

          {/* Password */}
          <div className="flex flex-col" style={{ gap: 6 }}>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}
              >
                Password
              </label>
              {isLogin && (
                <a
                  href="#"
                  style={{ fontSize: 13, color: '#2563eb', fontWeight: 500, textDecoration: 'none' }}
                >
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
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => Object.assign(e.target.style, { ...inputStyle, ...inputFocusStyle, paddingRight: '44px' })}
                onBlur={e  => Object.assign(e.target.style, { ...inputStyle, paddingRight: '44px' })}
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
            <label
              className="flex items-center gap-2"
              style={{ fontSize: 13.5, color: '#374151', cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                style={checkboxStyle}
              />
              Remember for 30 days
            </label>
          ) : (
            <label
              className="flex items-center gap-2"
              style={{ fontSize: 13.5, color: '#374151', cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                id="terms"
                required
                style={checkboxStyle}
              />
              I agree to the Terms &amp; Conditions
            </label>
          )}

          {/* Submit */}
          <button
            id="email-submit-btn"
            type="submit"
            disabled={anyBusy}
            className="w-full font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{
              height: 46,
              borderRadius: 8,
              border: 'none',
              background: anyBusy ? '#4f6ae0' : '#2040d4',
              fontSize: 15,
              cursor: anyBusy ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              marginTop: 2,
            }}
            onMouseEnter={e => { if (!anyBusy) e.target.style.background = '#1a35c0' }}
            onMouseLeave={e => { if (!anyBusy) e.target.style.background = '#2040d4' }}
          >
            {loading
              ? <><Spinner /> Processing…</>
              : (isLogin ? 'Log In' : 'Sign Up')
            }
          </button>
        </form>

        {/* ── Footer link ── */}
        <p
          className="text-center"
          style={{ fontSize: 13.5, color: '#6b7280', marginTop: 24 }}
        >
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={switchState}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#2563eb',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13.5,
            }}
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
