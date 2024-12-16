import express from 'express';
import { 
  createRecipe, 
  getRecipeById, 
  updateRecipe, 
  deleteRecipe, 
  getAllRecipes,
  getRecipesByUserId
} from '../controllers/recipeController.js';

const router = express.Router();

// Route to create a recipe
router.post("/:userId", createRecipe);

// Route to get a specific recipe
router.get("/:recipeId", getRecipeById);

// Route to update a recipe
router.put("/:userId", updateRecipe);

// Récupérer toutes les recettes par userId
router.get('/user/:userId', getRecipesByUserId);

// Route to delete a recipe
router.delete("/:recipeId", deleteRecipe);

// Route to get all recipes
router.get('/', getAllRecipes);

export default router;