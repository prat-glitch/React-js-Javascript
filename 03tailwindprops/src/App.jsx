import { useState } from 'react'
import './App.css'
import Card  from './components/card'
function App() {
  const [count, setCount] = useState(0)
  let myobj={
    name :"pratyush",
    age:21
  }
  return (
    <>
    <h1 className='bg-green-400 text-black p-5 rounded-3xl mb-3'>tailwind css</h1>
    <Card username="pratyush" someobj={myobj}/>
    <Card />
    </>
      
  )
}

export default App