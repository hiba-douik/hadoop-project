import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import client from '../config/hbaseConfig.js';

// Register a new user
export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Générer un userId unique
    const userId = uuidv4();

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer les données utilisateur
    const userData = [
      { column: 'info:username', $: username },
      { column: 'info:email', $: email },
      { column: 'info:password', $: hashedPassword },
      { column: 'info:createdAt', $: new Date().toISOString() },
    ];

    // Enregistrer l'utilisateur avec userId comme clé
    await client.table('user').row(email).put(userData);

    return res.status(201).json({ message: 'User registered successfully', userId, username, email });
  } catch (error) {
    console.error('Error registering user:', error);
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
    client.table('user').row(email).get((err, row) => {
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

        return res.status(200).json({
          email,
          username: user['info:username'],
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
    client.table('user').row(userId).delete((err) => {
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
    client.table('user').scan((err, rows) => {
      if (err) {
        return res.status(500).json({ message: 'Error retrieving users', details: err.message });
      }

      const users = rows.reduce((acc, row) => {
        const userKey = row.key;

        // Si l'utilisateur n'existe pas encore dans l'accumulateur, créez-le
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
      const userList = Object.values(users).filter(
        (user) => user.username && user.email && user.password
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
    if (!userId) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    console.log("Fetching user with email ID:", userId); // Debugging

    // Rechercher l'utilisateur par son email (userId = email)
    client.table('user').row(userId).get((err, row) => {
      if (err) {
        console.error('HBase Error:', err);
        return res.status(500).json({ message: 'Database error', details: err.message });
      }

      if (!row || row.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Reformater les données utilisateur
      const user = {};
      row.forEach((col) => {
        const [family, qualifier] = col.column.split(':');
        user[qualifier] = col.$;
      });

      return res.status(200).json({ user });
    });
  } catch (error) {
    console.error('Error fetching user:', error);
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

      client.table('user').row(userId).put(updatedData, (putErr) => {
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
