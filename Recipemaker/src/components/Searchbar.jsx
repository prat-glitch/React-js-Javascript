import { useState } from "react";
 
const Searchbar = ({onSearch}) =>
{
  const [value, setvalue] =useState("");

  const handlesubmit = (e) =>
  {
      e.preventDefault();
      const trimmed=value.trim();
      if(trimmed)
      {
        onSearch(trimmed);
        setvalue("");
      }
  };

return (
    <form onSubmit={handlesubmit} className="p-4 flex gap-3 justify-center">
        <input type="text" placeholder="search recipes..."
               value={value}
               onChange={(e) => setvalue(e.target.value)}className="w-2/3 md:w-1/2 px-3 py-2 border rounded-2xl shadow"
        />
        <button type="submit" className="bg-green-300 text-black px-4 py-3 rounded hover:bg-green-700 transition">Search</button>
    </form>
);
};

export default Searchbar;