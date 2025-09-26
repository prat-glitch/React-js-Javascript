import { useState } from "react";
import Header from "../components/Header";
import Searchbar from "../components/Searchbar";
import { fetchapi } from "../services/recipeapi";
import Recipecard from "../components/Recipecard";

const Home = () => {
  const [recipes, setrecipes] = useState([]);

  const handlesearch = async (value) => {
    const results = await fetchapi(value);
    console.log("Fetched recipes:", results);
    setrecipes(results);
  };

  return (
    <>
      <Header />
      <Searchbar onSearch={handlesearch}/>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 lg:grid-cols-3">
        {recipes.map((recipe) =>
        (
           <Recipecard key={recipe.id} recipe={recipe} />
        ))}
      </div>
      <Recipecard/>
 
    </>
  );
};

export default Home;
