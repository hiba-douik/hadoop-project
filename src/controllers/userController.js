import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import client from '../config/hbaseConfig.js';

// Helper functions
// Load environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';


if (JWT_SECRET === 'default_jwt_secret' || JWT_REFRESH_SECRET === 'default_refresh_secret') {
  console.warn('Warning: Using default JWT secrets. Set JWT_SECRET and JWT_REFRESH_SECRET in your environment for production.');
}
const generateAccessToken = (email) => {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
};

const generateRefreshToken = (email) => {
  return jwt.sign({ email }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// Register a new user
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Vérification si l'utilisateur existe déjà
    client.table('users').row(email).get((err, row) => {
      if (err && err.message.includes('404: Not Found')) {
        // Générer un userId unique
        const userId = uuidv4(); // Génère un identifiant unique pour l'utilisateur

        // Hashing du mot de passe
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
          if (hashErr) {
            return res.status(500).json({ message: 'Error hashing password', details: hashErr.message });
          }

          // Création des données de l'utilisateur avec le userId
          const userData = [
            { column: 'info:username', '$': username },
            { column: 'info:email', '$': email },
            { column: 'info:password', '$': hashedPassword },
            { column: 'info:userId', '$': userId }, // Ajouter le userId
            { column: 'info:createdAt', '$': new Date().toISOString() },
          ];

          // Enregistrer l'utilisateur dans la base de données
          client.table('users').row(email).put(userData, (putErr) => {
            if (putErr) {
              return res.status(500).json({ message: 'Error storing user data', details: putErr.message });
            }

            // Génération des tokens
            const accessToken = generateAccessToken(email);
            const refreshToken = generateRefreshToken(email);

            // Envoi du refresh token dans un cookie
            res.cookie('refreshToken', refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'Strict',
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
            });

            return res.status(201).json({ email, username, userId, accessToken });
          });
        });
      } else if (row && row.length > 0) {
        return res.status(400).json({ message: 'User already exists' });
      } else {
        return res.status(500).json({ message: 'Error checking user existence', details: err.message });
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};

// Login user
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    client.table('users').row(email).get((err, row) => {
      if (err || !row || row.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Extraction des données utilisateur
      const user = {};
      row.forEach((col) => {
        const [family, qualifier] = col.column.split(':');
        user[`${family}:${qualifier}`] = col.$;
      });

      bcrypt.compare(password, user['info:password'], (compareErr, isMatch) => {
        if (compareErr) {
          return res.status(500).json({ message: 'Error comparing passwords', details: compareErr.message });
        }

        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        const accessToken = generateAccessToken(email);
        const refreshToken = generateRefreshToken(email);

        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
        });

        return res.status(200).json({
          email,
          username: user['info:username'],
          accessToken,
          userId: email, // email comme userId
        });
      });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};

// Delete user by ID
export const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    client.table('users').row(userId).delete((err) => {
      if (err) {
        return res.status(500).json({ message: 'Error deleting user', details: err.message });
      }

      return res.status(200).json({ message: 'User deleted successfully' });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};


// Get all users
export const getAllUsers = async (req, res) => {
  try {
    client.table('users').scan((err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Error retrieving users', details: err.message });
      }

      const users = rows.reduce((acc, row) => {
        const userKey = row.key;
        
        // Si l'utilisateur n'existe pas encore dans l'accumulator, créez-le
        if (!acc[userKey]) {
          acc[userKey] = { id: userKey };
        }

        // Ajoutez les colonnes
        const [family, qualifier] = row.column.split(':');
        if (family === 'info') {
          acc[userKey][qualifier] = row.$;
        }

        return acc;
      }, {});

      // Convertir l'objet en tableau et filtrer les utilisateurs incomplets
      const userList = Object.values(users).filter(user => 
        user.username && user.email && user.password
      );

      return res.status(200).json({ users: userList });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};


// Get user by ID
export const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    // Check if the userId is valid
    if (!userId) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    client.table('users').row(userId).get((err, row) => {
      if (err || !row || row.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = {};

      if (Array.isArray(row)) {
        row.forEach((col) => {
          const [family, qualifier] = col.column.split(':');
          user[qualifier] = col.$;
        });
      } else if (typeof row === 'object') {
        Object.entries(row).forEach(([key, col]) => {
          const [family, qualifier] = key.split(':');
          user[qualifier] = col.$;
        });
      }

      return res.status(200).json({ user });
    });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};


// Update user by ID
export const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { username, password, email } = req.body;

  try {
    bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
      if (hashErr) {
        return res.status(500).json({ message: 'Error hashing password', details: hashErr.message });
      }

      const updatedData = [
        { column: 'info:username', '$': username },
        { column: 'info:password', '$': hashedPassword },
        { column: 'info:email', '$': email },
      ];

      client.table('users').row(userId).put(updatedData, (putErr) => {
        if (putErr) {
          return res.status(500).json({ message: 'Error updating user', details: putErr.message });
        }

        return res.status(200).json({ message: 'User updated successfully' });
      });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};
