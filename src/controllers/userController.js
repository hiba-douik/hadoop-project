// userController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import client from '../config/hbaseConfig.js';

// Helper functions
const generateAccessToken = (email) => {
  return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

const generateRefreshToken = (email) => {
  return jwt.sign({ email }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// Register a new user
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    client.table('users').row(email).get((err, row) => {
      if (err && err.message.includes('404: Not Found')) {
        bcrypt.hash(password, 10, (hashErr, hashedPassword) => {
          if (hashErr) {
            return res.status(500).json({ message: 'Error hashing password', details: hashErr.message });
          }

          const userData = [
            { column: 'info:username', '$': username },
            { column: 'info:password', '$': hashedPassword },
            { column: 'info:createdAt', '$': new Date().toISOString() },
          ];

          client.table('users').row(email).put(userData, (putErr) => {
            if (putErr) {
              return res.status(500).json({ message: 'Error storing user data', details: putErr.message });
            }

            const accessToken = generateAccessToken(email);
            const refreshToken = generateRefreshToken(email);

            res.cookie('refreshToken', refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'Strict',
              maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });

            return res.status(201).json({ email, username, accessToken });
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
      if (err || row.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = row.reduce((acc, col) => {
        const [family, qualifier] = col.column.split(':');
        acc[`${family}:${qualifier}`] = col.$;
        return acc;
      }, {});

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
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return res.status(200).json({ email, username: user['info:username'], accessToken });
      });
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

      const users = rows.map((row) => {
        const user = {};
        row.forEach((col) => {
          const [family, qualifier] = col.column.split(':');
          user[qualifier] = col.$;
        });
        return user;
      });

      return res.status(200).json({ users });
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error', details: error.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    client.table('users').row(userId).get((err, row) => {
      if (err || row.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = row.reduce((acc, col) => {
        const [family, qualifier] = col.column.split(':');
        acc[qualifier] = col.$;
        return acc;
      }, {});

      return res.status(200).json({ user });
    });
  } catch (error) {
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
