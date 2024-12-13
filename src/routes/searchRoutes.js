import { searchRecipes } from '../controllers/searchController.js';
import express from 'express';
const router = express.Router();


// Route pour la recherche de recettes
router.get('/api/search', searchRecipes);

export default router;
