import { useState , useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [products, setProducts] = useState([])
  const [loading, setloading]= useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('wood')
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setloading(true);
        setError(false);
        // Simulating a network request to fetch products
        // Replace this with your actual API endpoint
        // For example: const response = await fetch('https://api.example.com/products');
        // Here we assume the endpoint is '/api/products'
        const response = await fetch('/api/products?search=' + search);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setProducts(data);
        setloading(false);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, [])
  // if(error)
  // {
  //   return <h1>something went wrong</h1>
  // }
  // if(loading)
  // {
  //   return <h1>loading...</h1>
  // }
  return (
    <>
      <h1>welcome to the app</h1>
      <input type='text' placeholder='search products'
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      />
      {loading && (<h1>Loading...</h1>)}
      {error && (<h1>Something went wrong</h1>)}
      <h2>number of products are: {products.length}</h2>
    </>
  )
}

export default App
