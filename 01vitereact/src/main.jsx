import React from 'react'
import ReactDOM from 'react-dom/client'

function MyApp(){
    return (
        <div>
            <h1>Custom App | chai</h1>
            <a href="https://google.com" target='_blank'>Visit google</a>
            <a href="https://google.com" target='_blank'>click me to visit google</a>
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <MyApp />
)