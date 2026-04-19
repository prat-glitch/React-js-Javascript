// import { useState, useCallback, useEffect, useRef } from 'react'
// import './App.css'

// function App() {
//   const [length, setLength] = useState(8)
//   const [numberAllowed, setNumberAllowed] = useState(false);
//   const [charAllowed, setCharAllowed] = useState(false)
//   const [password, setPassword] = useState("")

//   //useRef hook
//   const passwordRef = useRef(null)

//   const passwordGenerator = useCallback(() => {
//     let pass = ""
//     let str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
//     if (numberAllowed) str += "0123456789"
//     if (charAllowed) str += "!@#$%^&*-_+=[]{}~`"

//     for (let i = 1; i <= length; i++) {
//       let char = Math.floor(Math.random() * str.length + 1)
//       pass += str.charAt(char)
//     }

//     setPassword(pass)


//   }, [length, numberAllowed, charAllowed, setPassword])

//   const copyPasswordToClipboard = useCallback(() => {
//     passwordRef.current?.select();
//     passwordRef.current?.setSelectionRange(0,10);
//     window.navigator.clipboard.writeText(password.slice(0,10))
//   }, [password])

//   useEffect(() => {
//     passwordGenerator()
//   }, [length, numberAllowed, charAllowed, passwordGenerator])
//   return (
    
//     <div className="w-full max-w-md mx-auto shadow-md rounded-lg px-4 py-3 my-8 bg-amber-100 text-orange-500">
//       <h1 className='text-black  text-center my-3 text-4xl'>Password generator</h1>
//     <div className="flex shadow rounded-lg overflow-hidden mb-4">
//         <input
//             type="text"
//             value={password}
//             className="outline-none w-full py-1 px-3"
//             placeholder="Password"
//             readOnly
//             ref={passwordRef}
//         />
//         <button
//         onClick={copyPasswordToClipboard}
//         className='outline-none bg-blue-700 text-white px-3 py-0.5 shrink-0'
//         >copy</button>
        
//     </div>
//     <div className='flex text-sm gap-x-2'>
//       <div className='flex items-center gap-x-1'>
//         <input 
//         type="range"
//         min={6}
//         max={100}
//         value={length}
//          className='cursor-pointer'
//          onChange={(e) => {setLength(e.target.value)}}
//           />
//           <label>Length: {length}</label>
//       </div>
//       <div className="flex items-center gap-x-1">
//       <input
//           type="checkbox"
//           defaultChecked={numberAllowed}
//           id="numberInput"
//           onChange={() => {
//               setNumberAllowed((prev) => !prev);
//           }}
//       />
//       <label htmlFor="numberInput">Numbers</label>
//       </div>
//       <div className="flex items-center gap-x-1">
//           <input
//               type="checkbox"
//               defaultChecked={charAllowed}
//               id="characterInput"
//               onChange={() => {
//                   setCharAllowed((prev) => !prev )
//               }}
//           />
//           <label htmlFor="characterInput">Characters</label>
//       </div>
//     </div>
// </div>
    
//   )
// }

// export default App


import { useState, useRef, useEffect } from "react";
import './App.css';

function App()
{
  const[password, setPassword] =useState("");
  const[length, setlength]= useState(6);
  const[number, setnumber]= useState(false);
  const[char, setchar]=useState(false);
  const passwordRef= useRef(null);

  useEffect(() =>
  {
     let chars= "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
     if(number) chars+="0123456789";
     if(char) chars+="!@#$%^&*()_+~`|}{[]:;?><,./-=";
     let pass="";
     for(let i=0;i<length;i++)
     {
      pass+=chars.charAt(Math.floor(Math.random()*chars.length));
     }
     setPassword(pass);
  }, [length, number , char]);

  const copypassword= ( )=>
  {
    passwordRef.current?.select();
    passwordRef.current?.selectionRange(0,20);
    window.navigator.clipboard.writeText(password.slice(0,20));
  };

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center">
      <div className="flex flex-col gap-6 bg-gray-900 hover:bg-gray-950 p-8 rounded-xl shadow-lg w-full max-w-md text-white">
        <h1 className="text-3xl font-bold text-center mb-2">Password Generator</h1>
        <input
          type="text"
          value={password}
          readOnly
          ref={passwordRef}
          className="bg-gray-800 text-white p-3 rounded mb-2 text-xl"
        />
        <button
          onClick={copypassword}
          className="bg-blue-500 hover:bg-blue-800 h-14 w-32 text-2xl rounded-md flex items-center justify-center mx-auto"
        >
          Copy
        </button>
        <div className="flex items-center gap-4">
          <input
            type="range"
            value={length}
            min={6}
            max={10}
            onChange={e => setlength(Number(e.target.value))}
            className="w-full"
          />
          <label className="text-lg">Length: {length}</label>
        </div>
        <div className="flex items-center gap-6 justify-center">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={number}
              onChange={() => setnumber(prev => !prev)}
              id="numbers"
            />
            <label htmlFor="numbers" className="text-lg">Numbers</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={char}
              onChange={() => setchar(prev => !prev)}
              id="special"
            />
            <label htmlFor="special" className="text-lg">Special Characters</label>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App;