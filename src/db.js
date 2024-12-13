// db.js
const neo4j = require('neo4j-driver');
require('dotenv').config();

// Connexion au driver Neo4j
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687', // URL de la base de données, avec un fallback
  neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD || 'siham2002') // Authentification
);

// Fonction pour récupérer une nouvelle session à chaque requête
const getSession = () => driver.session();

module.exports = { getSession };
