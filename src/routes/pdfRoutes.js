import { downloadRecipe } from '../controllers/pdfController.js';
import express from 'express';
const router = express.Router();


// Route for downloading the recipe as a PDF
router.post('/download-recipe', downloadRecipe);

export default router;
