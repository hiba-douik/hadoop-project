import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import userRoutes from './src/routes/userRoutes.js';
import recipeRoutes from './src/routes/recipeRoutes.js';
import searchRoutes from './src/routes/searchRoutes.js';
import pdfRoutes from './src/routes/pdfRoutes.js';

dotenv.config();

const app = express();

// Middleware to parse JSON body with increased limit
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));

// Middleware for parsing URL-encoded payload with increased limit
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Add CORS middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes utilisateur
app.use('/api/users', userRoutes);

// Use recipe routes
app.use('/api/recipes', recipeRoutes);

// Use search routes
app.use('/api/search', searchRoutes);

// Use PDF-related routes
app.use('/api/pdf', pdfRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
