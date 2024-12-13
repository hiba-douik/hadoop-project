import client from '../config/hbaseConfig.js';
import { v4 as uuidv4 } from 'uuid';

// Controller function to create a recipe
export async function createRecipe(req, res) {
  const { userId } = req.params;
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
    await client.table('recipes').row(recipeRow).put({
      'recipe:title': title,
      'recipe:description': description,
      'recipe:image': image,
      'recipe:userId': userId
    });

    // Ensure user exists
    await client.table('users').row(userRow).put({
      'user:id': userId
    });

    // Store instructions
    for (const [index, instruction] of instructions.entries()) {
      const instructionRow = `instruction:${recipeId}:${index}`;
      await client.table('instructions').row(instructionRow).put({
        'instruction:step': instruction.step,
        'instruction:recipeId': recipeId
      });
    }

    // Store ingredients
    for (const ingredient of ingredients) {
      const ingredientRow = `ingredient:${recipeId}:${ingredient.name}`;
      await client.table('ingredients').row(ingredientRow).put({
        'ingredient:name': ingredient.name,
        'ingredient:recipeId': recipeId
      });
    }

    // Create user-recipe relationship
    await client.table('user_recipes').row(userRow).put({
      'recipe:recipeId': recipeId
    });

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

// Controller function to get a recipe by ID
export async function getRecipeByTitle(req, res) {
  const { title } = req.params;

  try {
    // Scan for recipe by title
    const recipeResults = await client.table('recipes').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'title',
        compareOp: '=',
        comparator: title
      }
    });

    // If no recipe found
    if (recipeResults.length === 0) {
      return res.status(404).json({ message: 'Recette non trouvée' });
    }

    const recipeRow = recipeResults[0];
    const recipeId = recipeRow.key.split(':')[1];

    // Fetch instructions
    const instructionsResults = await client.table('instructions').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'recipeId',
        compareOp: '=',
        comparator: recipeId
      }
    });

    // Fetch ingredients
    const ingredientsResults = await client.table('ingredients').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'recipeId',
        compareOp: '=',
        comparator: recipeId
      }
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
    const recipeResults = await client.table('recipes').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'title',
        compareOp: '=',
        comparator: title
      }
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
    await client.table('recipes').row(newRecipeRow).put({
      'recipe:title': title,
      'recipe:description': description,
      'recipe:image': image,
      'recipe:userId': userId
    });

    // Delete and recreate instructions
    const oldInstructions = await client.table('instructions').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'recipeId',
        compareOp: '=',
        comparator: recipeId
      }
    });
    
    for (const oldInst of oldInstructions) {
      await client.table('instructions').row(oldInst.key).delete();
    }

    for (const [index, instruction] of instructions.entries()) {
      const instructionRow = `instruction:${newRecipeId}:${index}`;
      await client.table('instructions').row(instructionRow).put({
        'instruction:step': instruction.step,
        'instruction:recipeId': newRecipeId
      });
    }

    // Delete and recreate ingredients
    const oldIngredients = await client.table('ingredients').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'recipeId',
        compareOp: '=',
        comparator: recipeId
      }
    });
    
    for (const oldIng of oldIngredients) {
      await client.table('ingredients').row(oldIng.key).delete();
    }

    for (const ingredient of ingredients) {
      const ingredientRow = `ingredient:${newRecipeId}:${ingredient.name}`;
      await client.table('ingredients').row(ingredientRow).put({
        'ingredient:name': ingredient.name,
        'ingredient:recipeId': newRecipeId
      });
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
    const recipeResults = await client.table('recipes').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'title',
        compareOp: '=',
        comparator: title
      }
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
    const instructions = await client.table('instructions').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'recipeId',
        compareOp: '=',
        comparator: recipeId
      }
    });
    
    for (const inst of instructions) {
      await client.table('instructions').row(inst.key).delete();
    }

    // Delete related ingredients
    const ingredients = await client.table('ingredients').scan({
      filter: {
        type: 'qualifier',
        qualifier: 'recipeId',
        compareOp: '=',
        comparator: recipeId
      }
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