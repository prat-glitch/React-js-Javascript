import { useState } from 'react'
import './App.css'

function App() {
  const [bgColor,setbgColor] = useState("olive")

  return (
    <div className="w-full h-screen duration-100" style={{backgroundColor:bgColor}}>
      <div className="fixed flex flex-wrap justify-center bottom-10 inset-x-0 px-3 gap-3.5">
        <div className='flex flex-wrap justify-center gap-3 shadow-lg bg-white px-3 py-3 rounded-4xl'>
          <button 
           onClick={() => setbgColor("red")}className='outline-none px-3 py-1 rounded-b-full text-black shadow-lg'style={{backgroundColor:"red"}}>red</button>
          <button onClick={() => setbgColor("green")} className='outline-none px-3 py-1 rounded-b-full text-black shadow-lg'style={{backgroundColor:"green"}}>green</button>
          <button onClick= {() =>setbgColor("yellow")}className='outline-none px-3 py-1 rounded-b-full text-black shadow-lg'style={{backgroundColor:"yellow"}}>yellow</button>
          <button onClick={() =>setbgColor("pink")}className='outline-none px-3 py-1 rounded-b-full text-black shadow-lg'style={{backgroundColor:"pink"}}>pink</button>
        </div>
      </div>
    </div>
  )
}

export default App