import express from 'express';
import { 
  createRecipe, 
  getRecipeByTitle, 
  updateRecipe, 
  deleteRecipe 
} from '../controllers/recipeController.js';

const router = express.Router();

// Route to create a recipe
router.post("/api/recipes/:userId", createRecipe);

// Route to get a specific recipe
router.get("/api/recipe/:title", getRecipeByTitle);

// Route to update a recipe
router.put("/api/recipes/:userId", updateRecipe);

// Route to delete a recipe
router.delete("/api/recipes/:title", deleteRecipe);

export default router;