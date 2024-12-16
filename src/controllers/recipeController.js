import client from '../config/hbaseConfig.js';
import { v4 as uuidv4 } from 'uuid';

// Controller function to create a recipe
export const createRecipe = async (req, res) => {
  const { userId } = req.params; // Ici, userId = email
  console.log('User ID reçu dans le back-end:', userId);

  const { title, description, image, instructions, ingredients } = req.body;

  // Validation des champs requis
  if (!title || !description || !image || !instructions || !ingredients) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
  }

  try {
      const recipeId = uuidv4();
      const recipeRow = `recipe:${recipeId}`;
      const userRow = `user:${userId}`; // Utilise l'email comme clé pour HBase

      // Insérer les données de la recette
      await client.table('recipes').row(recipeRow).put([
          { column: 'recipe:title', $: title },
          { column: 'recipe:description', $: description },
          { column: 'recipe:image', $: image },
          { column: 'recipe:userId', $: userId }
      ]);

      // Vérifier l'existence de l'utilisateur
      await client.table('user').row(userRow).put([
          { column: 'info:id', $: userId }
      ]);

      // Ajouter les instructions
      for (const [index, instruction] of instructions.entries()) {
          await client.table('instructions').row(`instruction:${recipeId}:${index}`).put([
              { column: 'instruction:step', $: instruction.step },
              { column: 'instruction:recipeId', $: recipeId }
          ]);
      }

      // Ajouter les ingrédients
      for (const ingredient of ingredients) {
          await client.table('ingredients').row(`ingredient:${recipeId}:${ingredient.name}`).put([
              { column: 'ingredient:name', $: ingredient.name },
              { column: 'ingredient:recipeId', $: recipeId }
          ]);
      }

      res.status(201).json({
          message: 'Recette créée avec succès',
          recipe: {
              recipeId,
              title,
              description,
              image,
              userId,
              instructions,
              ingredients
          }
      });
  } catch (error) {
      console.error('Erreur lors de la création de la recette:', error);
      res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};


// Controller function to get all recipes
// Controller function to get all recipes
export const getAllRecipes = async (req, res) => {
  try {
    client.table('recipes').scan(async (err, recipeRows) => {
      if (err) {
        console.error("Erreur lors de la récupération des recettes:", err.message);
        return res.status(500).json({ message: 'Erreur serveur', details: err.message });
      }

      console.log("Raw recipe data fetched:", recipeRows);

      // Transform the rows into structured recipe objects
      const recipes = recipeRows.reduce((acc, row) => {
        const [family, qualifier] = row.column.split(':');
        const recipeKey = row.key;

        // Ensure the recipe object is initialized
        if (!acc[recipeKey]) {
          acc[recipeKey] = { id: recipeKey };
        }

        // Map recipe details if it's part of the 'recipe' family
        if (family === 'recipe' && qualifier) {
          acc[recipeKey][qualifier] = row.$;
        }

        return acc;
      }, {});

      console.log("Transformed Recipes:", recipes);

      // Filter recipes based on the existence of key details
      const recipeList = Object.values(recipes).filter(
        (recipe) => recipe.title && recipe.description && recipe.image
      );

      // If no recipes found, return a 404
      if (recipeList.length === 0) {
        return res.status(404).json({ message: 'Aucune recette trouvée' });
      }

      console.log("Filtered Recipes:", recipeList);

      const result = [];

      // Fetch associated instructions and ingredients for each recipe
      for (let recipe of recipeList) {
        const recipeId = recipe.id;

        // Fetch instructions for the current recipe
        const instructions = await new Promise((resolve, reject) => {
          client.table('instructions').scan((instErr, instructionRows) => {
            if (instErr) {
              console.error("Erreur lors de la récupération des instructions:", instErr.message);
              return reject(instErr);
            }

            const recipeInstructions = instructionRows.reduce((instAcc, instRow) => {
              const [family, qualifier] = instRow.column.split(':');
              if (family === 'instruction' && qualifier === 'step') {
                instAcc.push(instRow.$);
              }
              return instAcc;
            }, []);

            resolve(recipeInstructions);
          });
        });

        // Fetch ingredients for the current recipe
        const ingredients = await new Promise((resolve, reject) => {
          client.table('ingredients').scan((ingErr, ingredientRows) => {
            if (ingErr) {
              console.error("Erreur lors de la récupération des ingrédients:", ingErr.message);
              return reject(ingErr);
            }

            const recipeIngredients = ingredientRows.reduce((ingAcc, ingRow) => {
              const [family, qualifier] = ingRow.column.split(':');
              if (family === 'ingredient' && qualifier === 'name') {
                ingAcc.push(ingRow.$);
              }
              return ingAcc;
            }, []);

            resolve(recipeIngredients);
          });
        });

        // Add the recipe details, instructions, and ingredients to the result
        result.push({
          recipeId,
          title: recipe.title,
          description: recipe.description,
          image: recipe.image,
          instructions: instructions,
          ingredients: ingredients,
        });
      }

      // Return the final enriched recipes
      res.status(200).json({
        message: 'Toutes les recettes récupérées avec succès',
        recipes: result,
      });
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des recettes:", error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};


// Controller function to get all recipes by userId
// Controller function to get all recipes by userId
export const getRecipesByUserId = async (req, res) => {
  const { userId } = req.params;

  console.log("User ID received:", userId);

  if (!userId) {
    return res.status(400).json({ message: "Le userId est requis." });
  }

  try {
    client.table("recipes").scan(async (err, recipeRows) => {
      if (err) {
        console.error("Erreur lors de la récupération des recettes:", err.message);
        return res.status(500).json({ message: "Erreur serveur", details: err.message });
      }

      console.log("Raw recipe data fetched:", recipeRows);

      const userRecipes = recipeRows.reduce((acc, row) => {
        const [family, qualifier] = row.column.split(":");
        const recipeKey = row.key;

        if (!acc[recipeKey]) {
          acc[recipeKey] = { id: recipeKey };
        }

        if (family === "recipe" && qualifier) {
          acc[recipeKey][qualifier] = row.$;
        }

        return acc;
      }, {});

      // Normalize userId and compare
      const filteredRecipes = Object.values(userRecipes).filter((recipe) => {
        console.log(`Comparing recipe.userId: "${recipe.userId}" with userId: "${userId}"`);
        return recipe.userId?.trim().toLowerCase() === userId.trim().toLowerCase();
      });

      if (filteredRecipes.length === 0) {
        return res
          .status(404)
          .json({ message: `Aucune recette trouvée pour l'utilisateur ${userId}` });
      }

      console.log("Filtered Recipes:", filteredRecipes);

      const result = [];

      for (let recipe of filteredRecipes) {
        const recipeId = recipe.id;

        const instructions = await new Promise((resolve, reject) => {
          client.table("instructions").scan((instErr, instructionRows) => {
            if (instErr) {
              console.error("Erreur lors de la récupération des instructions:", instErr.message);
              return reject(instErr);
            }

            const recipeInstructions = instructionRows
              .reduce((instAcc, instRow) => {
                const [family, qualifier] = instRow.column.split(":");
                if (family === "instruction" && qualifier === "step") {
                  instAcc.push(instRow.$);
                }
                return instAcc;
              }, [])
              .filter((step) => step.includes(recipeId));

            resolve(recipeInstructions);
          });
        });

        const ingredients = await new Promise((resolve, reject) => {
          client.table("ingredients").scan((ingErr, ingredientRows) => {
            if (ingErr) {
              console.error("Erreur lors de la récupération des ingrédients:", ingErr.message);
              return reject(ingErr);
            }

            const recipeIngredients = ingredientRows
              .reduce((ingAcc, ingRow) => {
                const [family, qualifier] = ingRow.column.split(":");
                if (family === "ingredient" && qualifier === "name") {
                  ingAcc.push(ingRow.$);
                }
                return ingAcc;
              }, [])
              .filter((name) => name.includes(recipeId));

            resolve(recipeIngredients);
          });
        });

        result.push({
          recipeId,
          title: recipe.title,
          description: recipe.description,
          image: recipe.image,
          instructions: instructions,
          ingredients: ingredients,
        });
      }

      res.status(200).json({
        message: "Recettes récupérées avec succès",
        recipes: result,
      });
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des recettes par userId:", error);
    res.status(500).json({ message: "Erreur serveur", details: error.message });
  }
};

export async function getRecipeById(req, res) {
  const { recipeId } = req.params;
  console.log('Recipe ID:', recipeId);

  try {
    // Fetch recipe by recipeId from the 'recipes' table
    const recipeRows = await new Promise((resolve, reject) => {
      client.table('recipes').scan((err, rows) => {
        if (err) {
          console.error('Error fetching recipe:', err.message);
          reject(err);
        } else {
          // Filter rows to find the specific recipe
          const matchedRows = rows.filter(row => 
            row.key === recipeId && row.column.startsWith('recipe:')
          );
          resolve(matchedRows);
        }
      });
    });

    // If recipe not found
    if (!recipeRows || recipeRows.length === 0) {
      return res.status(404).json({ message: 'Recette non trouvée' });
    }

    // Convert recipe rows to a recipe object
    const recipe = recipeRows.reduce((acc, row) => {
      const [, qualifier] = row.column.split(':');
      acc[qualifier] = row.$;
      return acc;
    }, { id: recipeId });

    // Fetch instructions for the given recipeId
    const instructionsResults = await new Promise((resolve, reject) => {
      client.table('instructions').scan((err, rows) => {
        if (err) {
          console.error('Error fetching instructions:', err.message);
          reject(err);
        } else {
          // Filter instructions for this specific recipe
          const recipeInstructions = rows.filter(row => 
            row.key.startsWith(`instruction:${recipeId}`) && 
            row.column === 'instruction:step'
          );
          resolve(recipeInstructions);
        }
      });
    });

    // Fetch ingredients for the given recipeId
    const ingredientsResults = await new Promise((resolve, reject) => {
      client.table('ingredients').scan((err, rows) => {
        if (err) {
          console.error('Error fetching ingredients:', err.message);
          reject(err);
        } else {
          // Filter ingredients for this specific recipe
          const recipeIngredients = rows.filter(row => 
            row.key.startsWith(`ingredient:${recipeId}`) && 
            row.column === 'ingredient:name'
          );
          resolve(recipeIngredients);
        }
      });
    });

    // Parse instructions and ingredients
    const instructions = instructionsResults.map(inst => ({
      step: inst.$ || 'Step not available'
    }));

    const ingredients = ingredientsResults.map(ing => ({
      name: ing.$ || 'Ingredient not available'
    }));

    // Send the response with recipe, instructions, and ingredients
    res.status(200).json({
      message: 'Recette récupérée avec succès',
      recipe: {
        title: recipe.title || 'Title not available',
        description: recipe.description || 'Description not available',
        image: recipe.image || 'Image not available',
        userId: recipe.userId || 'User ID not available'
      },
      instructions,
      ingredients
    });
  } catch (error) {
    console.error('Error in getRecipeById:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
}


// Controller function to update a recipe
export async function updateRecipe(req, res) {
  const { userId } = req.params;
  const { title, description, image, instructions, ingredients } = req.body;

  // Validate required fields
  if (!title || !description || !image || !instructions || !ingredients) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }

  try {
    // Generate new recipe ID
    const recipeId = uuidv4(); // We generate a new ID to simulate updating by creating a new entry
    const recipeRow = `recipe:${recipeId}`;
    const userRow = `user:${userId}`; // Use userId (email) as the user row key

    // Update the recipe details in the 'recipes' table
    await client.table('recipes').row(recipeRow).put([
      { column: 'recipe:title', $: title },
      { column: 'recipe:description', $: description },
      { column: 'recipe:image', $: image },
      { column: 'recipe:userId', $: userId }
    ]);

    // Ensure user exists (checking user details in the 'user' table)
    await client.table('user').row(userRow).put([
      { column: 'info:id', $: userId }
    ]);

    // Add or update instructions
    for (const [index, instruction] of instructions.entries()) {
      await client.table('instructions').row(`instruction:${recipeId}:${index}`).put([
        { column: 'instruction:step', $: instruction.step },
        { column: 'instruction:recipeId', $: recipeId }
      ]);
    }

    // Add or update ingredients
    for (const ingredient of ingredients) {
      await client.table('ingredients').row(`ingredient:${recipeId}:${ingredient.name}`).put([
        { column: 'ingredient:name', $: ingredient.name },
        { column: 'ingredient:recipeId', $: recipeId }
      ]);
    }

    // Return updated recipe response
    res.status(200).json({
      message: 'Recette mise à jour avec succès',
      recipe: {
        recipeId,
        title,
        description,
        image,
        userId,
        instructions,
        ingredients
      }
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la recette:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
}

// Controller function to delete a recipe
export const deleteRecipe = async (req, res) => {
  const { recipeId } = req.params; // Use recipeId from params
  console.log('Request Parameters:', req.params);

  try {
    const recipeTable = client.table('recipes'); // Get reference to the recipes table
    
    console.log(`Fetching recipe details for recipeId: ${recipeId}`);
    
    // Try to fetch the recipe by the recipeId (direct lookup)
    const recipeRow = await new Promise((resolve, reject) => {
      recipeTable.row(recipeId).get((err, row) => {
        if (err) {
          console.error('Error during get of recipe:', err.message);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    // If recipeRow is empty, it means the recipe does not exist
    if (!recipeRow || Object.keys(recipeRow).length === 0) {
      return res.status(404).json({ message: 'Recette non trouvée' });
    }

    console.log(`Found recipeId: ${recipeId}`);

    // Deleting the recipe itself in the 'recipes' table using the row key
    await new Promise((resolve, reject) => {
      recipeTable.row(recipeId).delete((err) => {
        if (err) {
          console.error(`Error deleting recipe ${recipeId}:`, err);
          reject(err);
        } else {
          console.log(`Recipe ${recipeId} deleted successfully.`);
          resolve();
        }
      });
    });

    res.status(200).json({ message: 'Recette supprimée avec succès', recipeId });
  } catch (error) {
    console.error('Error in deleteRecipe:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
};












console.log("Recipe controller functions have been updated.");