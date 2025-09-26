const API_KEY = import.meta.env.VITE_SPOONACULAR_KEY;

export const fetchapi = async (query) => {
  if (!query) return [];

  try {
    const res = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?query=${query}&number=9&addRecipeInformation=true&apiKey=${API_KEY}`
      );
      

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return [];
  }
};
