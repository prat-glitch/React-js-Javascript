import React, { useState, useContext } from 'react'
import assets from '../../assets/assets' 
import { signup, Login as loginUser, googleSignIn } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import { Appcontext } from '../../context/Appcontext'

// shadcn ui imports
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Google icon as inline SVG — no external dependency needed
const GoogleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { loaduserdata } = useContext(Appcontext);
  const [currstate, setcurrstate] = useState('Sign Up');
  const [username, setusername] = useState('');
  const [email, setemail] = useState('');
  const [password, setpassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const onsubmithandler = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (currstate === "Sign Up") {
        await signup(username, email, password);
      } else {
        await loginUser(email, password);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // googleSignIn handles: popup → Firebase auth → Supabase JWT exchange
      // → profile upsert. After it resolves, onAuthStateChanged in AppContext
      // fires and handles routing automatically.
      await googleSignIn();
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-white sm:bg-slate-50 flex items-center justify-center p-0 sm:p-6 relative overflow-hidden'>
      <Card className="w-full h-[100dvh] sm:h-auto max-w-md relative z-10 shadow-none sm:shadow-sm border-0 sm:border border-slate-200 bg-white rounded-none sm:rounded-2xl overflow-hidden flex flex-col justify-center">
        
        {/* Header */}
        <CardHeader className="px-8 pt-8 pb-6 space-y-2 text-center flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-2">
            <img src={assets.logo_icon} alt='logo' className='w-6 h-6 brightness-[10]' />
          </div>
          <CardTitle className="text-2xl font-semibold text-slate-800 tracking-tight">
            {currstate === "Sign Up" ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription className="text-slate-500">
            {currstate === "Sign Up" 
              ? "Enter your details below to sign up" 
              : "Enter your email below to login to your account"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-8 pb-6">
          {/* ── Google Sign-In button ─────────────────────────── */}
          <Button
            id="google-signin-btn"
            type="button"
            variant="outline"
            className="w-full h-11 mb-5 rounded-lg border-slate-200 text-slate-700 font-medium flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 transition-all"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Connecting...
              </span>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </Button>

          {/* ── Divider ──────────────────────────────────────── */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400 font-medium">or continue with email</span>
            </div>
          </div>

          {/* ── Email / Password form ─────────────────────────── */}
          <form onSubmit={onsubmithandler}>
            <div className="flex flex-col gap-5">
              
              {currstate === "Sign Up" && (
                <div className="grid gap-2">
                  <Label htmlFor="username" className="text-slate-600">Full Name</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setusername(e.target.value)}
                    placeholder="John Doe"
                    className="h-11 rounded-lg border-slate-200 focus-visible:ring-blue-500 bg-slate-50/50"
                    required
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-slate-600">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setemail(e.target.value)}
                  placeholder="m@example.com"
                  className="h-11 rounded-lg border-slate-200 focus-visible:ring-blue-500 bg-slate-50/50"
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-slate-600">Password</Label>
                  {currstate === "Login" && (
                    <a
                      href="#"
                      className="ml-auto inline-block text-xs font-medium hover:text-blue-600 text-slate-500 transition-colors"
                    >
                      Forgot password?
                    </a>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setpassword(e.target.value)}
                  className="h-11 rounded-lg border-slate-200 focus-visible:ring-blue-500 bg-slate-50/50"
                  required 
                />
              </div>

              {currstate === "Sign Up" && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <input type='checkbox' id="terms" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" required />
                  <label htmlFor="terms">I agree to the Terms &amp; Conditions</label>
                </div>
              )}

              <Button
                id="email-submit-btn"
                type="submit"
                className="w-full mt-2 h-11 text-[15px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all"
                disabled={loading || googleLoading}
              >
                {loading ? "Processing..." : (currstate === "Sign Up" ? "Sign Up" : "Login")}
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="px-8 pb-8 flex flex-col gap-3 justify-center border-t border-slate-100 pt-6">
          <p className="text-sm text-slate-500 text-center">
            {currstate === "Sign Up" ? "Already have an account? " : "Don't have an account? "}
            <span 
              className='text-blue-600 font-semibold cursor-pointer hover:text-blue-700 transition-all' 
              onClick={() => setcurrstate(currstate === 'Sign Up' ? 'Login' : 'Sign Up')}
            >
              {currstate === "Sign Up" ? "Login" : "Sign up"}
            </span>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default Login
