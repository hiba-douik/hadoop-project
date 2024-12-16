import client from '../config/hbaseConfig.js';
import { v4 as uuidv4 } from 'uuid';

// Controller function to create a recipe
export const createRecipe = async (req, res) => {

  const { userId } = req.params;
  console.log('User ID reçu dans le back-end:', userId);
  const { title, description, image, instructions, ingredients } = req.body;
  


  // Validate required fields
  if (!title || !description || !image || !instructions || !ingredients) {
    return res.status(400).json({ message: 'Tous les champs sont requis' });
  }

  try {
    // Generate unique identifiers
    const recipeId = uuidv4();
    const recipeRow = `recipe:${recipeId}`;
    const userRow = `user:${userId}`;

    // Store recipe details
    await client.table('recipes').row(recipeRow).put([
      { column: 'recipe:title', $: title },
      { column: 'recipe:description', $: description },
      { column: 'recipe:image', $: image },
      { column: 'recipe:userId', $: userId }
    ]);

    // Ensure user exists
    await client.table('users').row(userRow).put([
      { column: 'user:id', $: userId }
    ]);

    // Store instructions
    for (const [index, instruction] of instructions.entries()) {
      const instructionRow = `instruction:${recipeId}:${index}`;
      await client.table('instructions').row(instructionRow).put([
        { column: 'instruction:step', $: instruction.step },
        { column: 'instruction:recipeId', $: recipeId }
      ]);
    }

    // Store ingredients
    for (const ingredient of ingredients) {
      const ingredientRow = `ingredient:${recipeId}:${ingredient.name}`;
      await client.table('ingredients').row(ingredientRow).put([
        { column: 'ingredient:name', $: ingredient.name },
        { column: 'ingredient:recipeId', $: recipeId }
      ]);
    }

    // Create user-recipe relationship
    await client.table('user_recipes').row(userRow).put([
      { column: 'recipe:recipeId', $: recipeId }
    ]);

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
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// Controller function to get all recipes
export const getAllRecipes = async (req, res) => {
  try {
    client.table('recipes').scan((err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Erreur lors de la récupération des recettes', details: err.message });
      }
      
      const recipes = rows.reduce((acc, row) => {
        const recipeKey = row.key;
        
        // Si la recette n'existe pas encore dans l'accumulateur, créez-la
        if (!acc[recipeKey]) {
          acc[recipeKey] = { id: recipeKey };
        }
        
        // Ajoutez les colonnes par famille
        const [family, qualifier] = row.column.split(':');
        
        // Logique de remplissage des informations de la recette
        if (family === 'info') {
          acc[recipeKey][qualifier] = row.$;
        }
        
        if (family === 'ingredients') {
          if (!acc[recipeKey].ingredients) {
            acc[recipeKey].ingredients = {};
          }
          acc[recipeKey].ingredients[qualifier] = row.$;
        }
        
        if (family === 'metadata') {
          if (!acc[recipeKey].metadata) {
            acc[recipeKey].metadata = {};
          }
          acc[recipeKey].metadata[qualifier] = row.$;
        }
        
        return acc;
      }, {});
      
      // Convertir l'objet en tableau et filtrer les recettes complètes
      const recipeList = Object.values(recipes).filter(recipe => 
        recipe.name && recipe.description && recipe.instructions
      );
      
      return res.status(200).json({ 
        message: 'Toutes les recettes récupérées avec succès',
        recipes: recipeList 
      });
    });
  } catch (error) {
    return res.status(500).json({ 
      message: 'Erreur serveur', 
      details: error.message 
    });
  }
};

// Controller function to get a recipe by title
export async function getRecipeByTitle(req, res) {
  const { title } = req.params;

  try {
    // Scan for recipe by title
    const recipeResults = await new Promise((resolve, reject) => {
      client.table('recipes').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: title
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // If no recipe found
    if (recipeResults.length === 0) {
      return res.status(404).json({ message: 'Recette non trouvée' });
    }

    const recipeRow = recipeResults[0];
    const recipeId = recipeRow.key.split(':')[1];

    // Fetch instructions
    const instructionsResults = await new Promise((resolve, reject) => {
      client.table('instructions').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: recipeId
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Fetch ingredients
    const ingredientsResults = await new Promise((resolve, reject) => {
      client.table('ingredients').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: recipeId
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Parse instructions and ingredients
    const instructions = instructionsResults.map(inst => ({
      step: inst.columns['instruction:step']
    }));

    const ingredients = ingredientsResults.map(ing => ({
      name: ing.columns['ingredient:name']
    }));

    res.status(200).json({
      message: 'Recette récupérée avec succès',
      recipe: {
        title: recipeRow.columns['recipe:title'],
        description: recipeRow.columns['recipe:description'],
        image: recipeRow.columns['recipe:image'],
        userId: recipeRow.columns['recipe:userId']
      },
      instructions,
      ingredients
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la recette:', error);
    res.status(500).json({ message: 'Erreur serveur' });
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
    // Scan for existing recipe by title
    const recipeResults = await new Promise((resolve, reject) => {
      client.table('recipes').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: title
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // If no recipe found
    if (recipeResults.length === 0) {
      return res.status(404).json({ message: 'Recette non trouvée' });
    }

    const oldRecipeRow = recipeResults[0];
    const recipeId = oldRecipeRow.key.split(':')[1];
    const newRecipeId = uuidv4();
    const newRecipeRow = `recipe:${newRecipeId}`;

    // Delete old recipe and create a new one
    await client.table('recipes').row(oldRecipeRow.key).delete();
    await client.table('recipes').row(newRecipeRow).put([
      { column: 'recipe:title', $: title },
      { column: 'recipe:description', $: description },
      { column: 'recipe:image', $: image },
      { column: 'recipe:userId', $: userId }
    ]);

    // Delete and recreate instructions
    const oldInstructions = await new Promise((resolve, reject) => {
      client.table('instructions').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: recipeId
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const oldInst of oldInstructions) {
      await client.table('instructions').row(oldInst.key).delete();
    }

    for (const [index, instruction] of instructions.entries()) {
      const instructionRow = `instruction:${newRecipeId}:${index}`;
      await client.table('instructions').row(instructionRow).put([
        { column: 'instruction:step', $: instruction.step },
        { column: 'instruction:recipeId', $: newRecipeId }
      ]);
    }

    // Delete and recreate ingredients
    const oldIngredients = await new Promise((resolve, reject) => {
      client.table('ingredients').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: recipeId
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const oldIng of oldIngredients) {
      await client.table('ingredients').row(oldIng.key).delete();
    }

    for (const ingredient of ingredients) {
      const ingredientRow = `ingredient:${newRecipeId}:${ingredient.name}`;
      await client.table('ingredients').row(ingredientRow).put([
        { column: 'ingredient:name', $: ingredient.name },
        { column: 'ingredient:recipeId', $: newRecipeId }
      ]);
    }

    res.status(200).json({
      message: 'Recette mise à jour avec succès',
      recipe: {
        recipeId: newRecipeId,
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
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

// Controller function to delete a recipe
export async function deleteRecipe(req, res) {
  const { title } = req.params;

  try {
    // Scan for recipe by title
    const recipeResults = await new Promise((resolve, reject) => {
      client.table('recipes').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: title
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // If no recipe found
    if (recipeResults.length === 0) {
      return res.status(404).json({ message: 'Recette non trouvée' });
    }

    const recipeRow = recipeResults[0];
    const recipeId = recipeRow.key.split(':')[1];

    // Delete recipe
    await client.table('recipes').row(recipeRow.key).delete();

    // Delete related instructions
    const instructions = await new Promise((resolve, reject) => {
      client.table('instructions').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: recipeId
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const inst of instructions) {
      await client.table('instructions').row(inst.key).delete();
    }

    // Delete related ingredients
    const ingredients = await new Promise((resolve, reject) => {
      client.table('ingredients').scan({
        filter: {
          type: 'ValueFilter',
          op: 'EQUAL',
          comparator: recipeId
        }
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    for (const ing of ingredients) {
      await client.table('ingredients').row(ing.key).delete();
    }

    res.status(200).json({
      message: 'Recette supprimée avec succès',
      title
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la recette:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
}

console.log("Recipe controller functions have been updated.");