import client from "../config/hbaseConfig.js";

export const searchRecipes = async (req, res) => {
  const { ingredients } = req.query;

  console.log(ingredients)

  // Validate required query parameter
  if (!ingredients || typeof ingredients !== "string") {
    return res.status(400).json({
      message: 'Le paramètre "ingredients" est requis et doit être une chaîne de caractères.',
    });
  }

  try {
    // Parse the ingredients into a list
    const ingredientList = ingredients
      .split(",")
      .map((ingredient) => ingredient.trim())
      .filter(Boolean);

    if (ingredientList.length === 0) {
      return res.status(400).json({
        message: "Veuillez fournir au moins un ingrédient valide.",
      });
    }

    // Fetch all rows for the given ingredients
    const recipesByIngredient = await Promise.all(
      ingredientList.map((ingredient) =>
        new Promise((resolve, reject) => {
          client.table("ingredients").scan(
            {
              filter: {
                op: "EQUAL",
                qualifier: "ingredient:name",
                comparator: ingredient,
              },
            },
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        })
      )
    );

    // Extract unique recipe IDs
    const recipeIds = [
      ...new Set(
        recipesByIngredient
          .flat()
          .map((row) => row["ingredient:recipeId"])
      ),
    ];

    if (recipeIds.length === 0) {
      return res.status(404).json({
        message: "Aucune recette trouvée pour les ingrédients fournis.",
      });
    }

    // Fetch recipe details for each unique recipeId
    const recipes = await Promise.all(
      recipeIds.map((recipeId) =>
        new Promise((resolve, reject) => {
          client.table("recipes").row(recipeId).get((err, recipeRow) => {
            if (err) {
              reject(err);
            } else if (!recipeRow || Object.keys(recipeRow).length === 0) {
              resolve(null);
            } else {
              resolve({
                recipeId,
                title: recipeRow["recipe:title"],
                description: recipeRow["recipe:description"],
                image: recipeRow["recipe:image"],
                ingredients: recipesByIngredient
                  .flat()
                  .filter((row) => row["ingredient:recipeId"] === recipeId)
                  .map((row) => row["ingredient:name"]),
              });
            }
          });
        })
      )
    );

    const filteredRecipes = recipes.filter(Boolean);

    if (filteredRecipes.length === 0) {
      return res.status(404).json({
        message: "Aucune recette complète trouvée.",
      });
    }

    res.status(200).json(filteredRecipes);
  } catch (error) {
    console.error("Erreur lors de la recherche des recettes:", error);
    res.status(500).json({
      message: "Erreur serveur",
      details: error.message,
    });
  }
};
