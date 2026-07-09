import React, { useState, useContext } from 'react'
import assets from '../../assets/assets' 
import { signup, Login as loginUser, auth } from '../../config/firebase'
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

const Login = () => {
  const navigate = useNavigate();
  const { loaduserdata } = useContext(Appcontext);
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
        await signup(username, email, password);
      } else {
        await loginUser(email, password);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-white sm:bg-slate-50 flex items-center justify-center p-0 sm:p-6 relative overflow-hidden'>
      <Card className="w-full h-[100dvh] sm:h-auto max-w-md relative z-10 shadow-none sm:shadow-sm border-0 sm:border border-slate-200 bg-white rounded-none sm:rounded-2xl overflow-hidden flex flex-col justify-center">
        
        {/* Added px-8 pt-8 here to push the title away from the edges */}
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
        
        {/* Added px-8 pb-8 here to pad the sides of the form */}
        <CardContent className="px-8 pb-6">
          <form onSubmit={onsubmithandler}>
            <div className="flex flex-col gap-5">
              
              {/* Removed mx-4 from the inputs so they align perfectly! */}
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
                  <label htmlFor="terms">I agree to the Terms & Conditions</label>
                </div>
              )}

              <Button type="submit" className="w-full mt-2 h-11 text-[15px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all" disabled={loading}>
                {loading ? "Processing..." : (currstate === "Sign Up" ? "Sign Up" : "Login")}
              </Button>
            </div>
          </form>
        </CardContent>

        {/* Added px-8 pb-8 here for the bottom link */}
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
