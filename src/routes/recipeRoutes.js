import express from 'express';
import { 
  createRecipe, 
  getRecipeByTitle, 
  updateRecipe, 
  deleteRecipe, 
  getAllRecipes
} from '../controllers/recipeController.js';

const router = express.Router();

// Route to create a recipe
router.post("/:userId", createRecipe);

// Route to get a specific recipe
router.get("/:title", getRecipeByTitle);

// Route to update a recipe
router.put("/:userId", updateRecipe);

// Route to delete a recipe
router.delete("/:title", deleteRecipe);
// Route to get all recipes
router.get('/', getAllRecipes);

export default router;