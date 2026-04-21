import React, { useState } from 'react'
import assets from '../../assets/assets' 
import { signup, Login as loginUser } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'

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
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/25 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/25 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/2"></div>

      {/* Removed the p-6 from here so it doesn't conflict */}
      <Card className="w-full max-w-lg relative z-10 shadow-3xl bg-white rounded-3xl overflow-hidden">
        
        {/* Added px-8 pt-8 here to push the title away from the edges */}
        <CardHeader className="px-10 pt-10 pb-6 space-y-2 text-center flex flex-col items-center">
          <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center mb-2 shadow-xl">
            <img src={assets.logo_icon} alt='logo' className='w-8 h-8 brightness-[10]' />
          </div>
          <CardTitle className="text-3xl font-bold">
            {currstate === "Sign Up" ? "Create an account" : "Login to your account"}
          </CardTitle>
          <CardDescription>
            {currstate === "Sign Up" 
              ? "Enter your details below to sign up" 
              : "Enter your email below to login to your account"}
          </CardDescription>
        </CardHeader>
        
        {/* Added px-10 pb-8 here to pad the sides of the form */}
        <CardContent className="px-10 pb-8">
          <form onSubmit={onsubmithandler}>
            <div className="flex flex-col gap-6">
              
              {/* Removed mx-4 from the inputs so they align perfectly! */}
              {currstate === "Sign Up" && (
                <div className="grid gap-3">
                  <Label htmlFor="username">Full Name</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setusername(e.target.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
              )}

              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setemail(e.target.value)}
                  placeholder="m@example.com"
                  required
                />
              </div>

              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  {currstate === "Login" && (
                    <a
                      href="#"
                      className="ml-auto inline-block text-sm underline-offset-4 hover:underline text-slate-500"
                    >
                      Forgot your password?
                    </a>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setpassword(e.target.value)}
                  required 
                />
              </div>

              {currstate === "Sign Up" && (
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <input type='checkbox' id="terms" className="rounded" required />
                  <label htmlFor="terms">I agree to the Fluid Terms & Conditions.</label>
                </div>
              )}

              <Button type="submit" className="w-full mt-3 py-6 text-lg font-semibold bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl text-white" disabled={loading}>
                {loading ? "Processing..." : (currstate === "Sign Up" ? "Sign Up" : "Login")}
              </Button>
            </div>
          </form>
        </CardContent>

        {/* Added px-10 pb-10 here for the bottom link */}
        <CardFooter className="px-10 pb-10 flex flex-col gap-3 justify-center">
          <p className="text-base text-slate-500 text-center">
            {currstate === "Sign Up" ? "Already part of the flow? " : "New to the exchange? "}
            <span 
              className='text-blue-600 font-medium cursor-pointer hover:underline transition-all' 
              onClick={() => setcurrstate(currstate === 'Sign Up' ? 'Login' : 'Sign Up')}
            >
              {currstate === "Sign Up" ? "Login" : "Sign Up"}
            </span>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default Login
