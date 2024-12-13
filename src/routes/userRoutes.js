import express from 'express';
import {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
} from '../controllers/userController.js';

const router = express.Router();

// Route to register a new user
router.post('/register', registerUser);

// Route to login a user
router.post('/login', loginUser);

// Route to get all users
router.get('/', getAllUsers);

// Route to get a user by ID
router.get('/:userId', getUserById);

// Route to update a user by ID
router.put('/:userId', updateUser);

export default router;
