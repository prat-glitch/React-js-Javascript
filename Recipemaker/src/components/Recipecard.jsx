const Recipecard = ({ recipe }) => {
    if (!recipe) return null;
  
    const { title, image, summary, sourceUrl } = recipe;
  
    return (
      <div className="bg-white shadow-md rounded-xl overflow-hidden hover:shadow-xl transition duration-300">
        {image && (
          <img
            src={image}
            alt={title}
            className="w-full h-48 object-cover"
          />
        )}
  
        <div className="p-4">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {title}
          </h3>
  
          <p className="text-md text-emerald-500 mb-4">
            {summary
              ? summary.replace(/<[^>]+>/g, "").slice(0, 100) + "..."
              : "No description available"}
          </p> 
  
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white font-bold text-black px-3 py-2 rounded hover:bg-green-300 transition duration-200"
          >
            View Recipe
          </a>
        </div>
      </div>
    );
  };
  
  export default Recipecard;
  