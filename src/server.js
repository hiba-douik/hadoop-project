const express = require('express');
const bodyParser = require('body-parser');
const neo4j = require('neo4j-driver');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const router = express.Router();
// Créer une instance d'Express
const app = express();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3001', // Origine autorisée
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Méthodes autorisées
    allowedHeaders: ['Content-Type', 'Authorization'], // Headers autorisés
  }));
  app.use(express.json());

const driver = neo4j.driver(
  'bolt://localhost:7687', // L'URL de connexion à Neo4j
  neo4j.auth.basic('neo4j', 'siham2002') // Remplacez 'password' par votre mot de passe Neo4j
);

// Créer une session
const session = driver.session({ database: 'neo4j' });


/// Route pour créer un nouvel utilisateur
app.post('/users', async (req, res) => {
    const { userId, username, password, role, _id, email } = req.body;
    console.log('Données reçues:', req.body);

    try {

      const result = await session.run(
        'CREATE (u:User {userId: $userId, username: $username, password: $password, email: $email}) RETURN u',
        {
          userId,
          username,
          password,
          role,
          _id,
          email
        }
      );
      console.log('Données envoyées à la base de données:', {
        userId,
        username,
        password,
        role,
        _id,
        email
      });

      if (result.records.length > 0) {
        const createdUser = result.records[0].get('u');
        res.status(201).json({
          message: 'Utilisateur créé avec succès',
          user: createdUser.properties
        });
      } else {
        res.status(400).json({ message: 'Erreur lors de la création de l\'utilisateur' });
      }
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  });


app.put('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const { username, password, role, email } = req.body;

    console.log('Données reçues:', req.body);

    try {
        // Requête Cypher pour trouver l'utilisateur par userId et mettre à jour ses informations
        const result = await session.run(
            `MATCH (u:User {userId: $userId})
         SET u.username = $username, u.password = $password, u.role = $role, u.email = $email
         RETURN u`,
            {
                userId,
                username,
                password,
                role,
                email
            }
        );

        // Si l'utilisateur a été trouvé et mis à jour
        if (result.records.length > 0) {
            const updatedUser = result.records[0].get('u');
            res.status(200).json({
                message: 'Utilisateur mis à jour avec succès',
                user: updatedUser.properties
            });
        } else {
            res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

  // Route pour afficher tous les utilisateurs

app.get('/users', async (req, res) => {
    try {
      const result = await session.run('MATCH (u:User) RETURN u');

      const users = result.records.map(record => record.get('u').properties);

      res.status(200).json({
        message: 'Utilisateurs récupérés avec succès',
        users
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  });


  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('Email et mot de passe requis');
    }

    try {
        const result = await session.run(
            'MATCH (u:User {email: $email,password:$password}) RETURN u',
            { email,password }
        );
        console.log(result);

        if (result.records.length === 0) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        const user = result.records[0].get('u').properties;



        res.status(200).send({ message: 'Connexion réussie', user });

    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur serveur');
    } finally {

    }
});





app.get('/users/:userId', async (req, res) => {
    const { userId } = req.params; // Récupérer le userId à partir des paramètres de l'URL

    try {
        const result = await session.run(
            'MATCH (u:User {userId: $userId}) RETURN u',
            { userId }
        );

        if (result.records.length === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        const user = result.records[0].get('u').properties;

        res.status(200).json({
            message: 'Utilisateur trouvé',
            user
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});


// Route pour afficher les recettes d'un utilisateur
app.get('/api/recipes/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log("ID de l'utilisateur reçu :", userId); // Log de l'ID utilisateur reçu
    const session = driver.session();

    try {
        // Vérifie si l'utilisateur existe d'abord
        const userCheck = await session.run(
            `MATCH (u:User {userId: $userId}) RETURN u`,
            { userId }
        );

        // Si l'utilisateur n'existe pas, retourne un message d'erreur
        if (userCheck.records.length === 0) {
            return res.status(404).json({ message: "Utilisateur non trouvé." });
        }

        // Récupère les informations de l'utilisateur
        const userNode = userCheck.records[0].get('u');
        const user = {
            id: userNode.identity.low,
            ...userNode.properties, // Inclut les propriétés de l'utilisateur
        };

        console.log("Utilisateur trouvé : ", user); // Log de l'utilisateur trouvé

        // Exécute une requête pour récupérer les recettes et les relations avec les instructions et les ingrédients
        const result = await session.run(
            `
            MATCH (u:User {userId: $userId})-[:HAS_RECIPE]->(r:Recipe)
            OPTIONAL MATCH (r)-[:HAS_INSTRUCTION]->(i:Instruction)
            OPTIONAL MATCH (r)-[:HAS_INGREDIENT]->(ing:Ingredient)
            WITH r, collect({step: i.step}) AS instructions,
                 collect({name: ing.name}) AS ingredients
            RETURN {
              recipeName: r.title,
              description: r.description,
              image: r.image,
              instructions: instructions,
              ingredients: ingredients
            } AS recipeData
            `,
            { userId }
        );

        // Traite les résultats pour structurer les recettes
        const recipes = result.records.map((record) => {
            const recipe = record.get('recipeData');

            // Supprime les doublons dans les instructions et ingrédients
            recipe.instructions = [...new Set(recipe.instructions.map(i => JSON.stringify(i)))].map(i => JSON.parse(i));
            recipe.ingredients = [...new Set(recipe.ingredients.map(i => JSON.stringify(i)))].map(i => JSON.parse(i));

            return recipe;
        });

        console.log('Recettes trouvées :', recipes);

        // Retourne l'utilisateur avec ses recettes
        res.status(200).json({ user, recipes });
    } catch (error) {
        console.error('Erreur lors de la récupération des données :', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        await session.close(); // Ferme la session Neo4j
    }
});


//// la creation de recettes

app.post('/api/recipes/:userId', async (req, res) => {
    const { title, description, image, instructions, ingredients } = req.body;
    const { userId } = req.params;

    // Vérifier que tous les champs nécessaires sont fournis
    if (!title || !description || !image || !instructions || !ingredients || !userId) {
        return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const session = driver.session();

    try {
        // 1. Créer ou fusionner la recette
        const createRecipeResult = await session.run(
            'MERGE (r:Recipe {title: $title}) ' +
            'ON CREATE SET r.description = $description, r.image = $image ' +
            'RETURN r',
            { title, description, image }
        );

        const recipeNode = createRecipeResult.records[0].get('r');
        const recipeElementId = recipeNode.identity.low;

        console.log('Recette créée ou existante:', recipeNode);

        // 2. Fusionner l'utilisateur
        const createUserResult = await session.run(
            'MERGE (u:User {userId: $userId}) RETURN u',
            { userId }
        );
        const userNode = createUserResult.records[0].get('u');
        console.log('Utilisateur créé ou existant:', userNode);

        // 3. Créer une relation entre l'utilisateur et la recette
        await session.run(
            'MATCH (r:Recipe {title: $title}), (u:User {userId: $userId}) ' +
            'MERGE (u)-[:HAS_RECIPE]->(r)',
            { title, userId }
        );

        console.log('Relation utilisateur-recette créée');

        // 4. Ajouter des instructions
        for (const instruction of instructions) {
            const createInstructionResult = await session.run(
                'MERGE (i:Instruction {step: $step}) RETURN i',
                { step: instruction.step }
            );

            const instructionNode = createInstructionResult.records[0].get('i');
            const instructionElementId = instructionNode.identity.low;

            // Relier l'instruction à la recette
            await session.run(
                'MATCH (r:Recipe), (i:Instruction) WHERE id(r) = $recipeId AND id(i) = $instructionId ' +
                'MERGE (r)-[:HAS_INSTRUCTION]->(i)',
                { recipeId: recipeElementId, instructionId: instructionElementId }
            );

            console.log('Instruction ajoutée:', instructionNode);
        }

        // 5. Ajouter des ingrédients
        for (const ingredient of ingredients) {
            const createIngredientResult = await session.run(
                'MERGE (i:Ingredient {name: $name}) RETURN i',
                { name: ingredient.name }
            );

            const ingredientNode = createIngredientResult.records[0].get('i');
            const ingredientElementId = ingredientNode.identity.low;

            // Relier l'ingrédient à la recette
            await session.run(
                'MATCH (r:Recipe), (i:Ingredient) WHERE id(r) = $recipeId AND id(i) = $ingredientId ' +
                'MERGE (r)-[:HAS_INGREDIENT]->(i)',
                { recipeId: recipeElementId, ingredientId: ingredientElementId }
            );

            console.log('Ingrédient ajouté:', ingredientNode);
        }

        // 6. Réponse de succès
        res.status(201).json({
            message: 'Recette créée avec succès',
            recipe: {
                title,
                description,
                image,
                recipeId: recipeElementId,
                instructions,
                ingredients
            },
            userId
        });
    } catch (error) {
        console.error('Erreur lors de la création de la recette:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        await session.close();
    }
});







app.put('/api/recipes/:userId', async (req, res) => {
    const { userId } = req.params; // Récupérer userId des paramètres de l'URL
    const { title, description, image, instructions, ingredients } = req.body;

    // Vérification des champs requis
    if (!title || !description || !image || !instructions || !ingredients) {
        return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const session = driver.session();

    try {
        // 1. Créer ou récupérer l'utilisateur
        const createUserResult = await session.run(
            'MERGE (u:User {userId: $userId}) RETURN u',
            { userId }
        );

        const userNode = createUserResult.records[0].get('u');
        console.log('Utilisateur créé ou existant:', userNode);

        // 2. Supprimer l'ancienne recette par le titre
        await session.run(
            'MATCH (r:Recipe {title: $title}) DETACH DELETE r',
            { title }
        );
        console.log(`Recette avec le titre "${title}" supprimée.`);

        // 3. Créer une nouvelle recette
        const createRecipeResult = await session.run(
            'CREATE (r:Recipe {title: $title, description: $description, image: $image, userId: $userId}) RETURN r',
            { title, description, image, userId } // Passer le userId ici
        );

        const recipeNode = createRecipeResult.records[0].get('r');
        const newRecipeId = recipeNode.identity.low; // ID de la nouvelle recette
        console.log('Nouvelle recette créée:', recipeNode);

        // 4. Ajouter la relation entre l'utilisateur et la recette
        await session.run(
            'MATCH (u:User {userId: $userId}), (r:Recipe {title: $title}) ' +
            'MERGE (u)-[:HAS_RECIPE]->(r)',
            { userId, title }
        );
        console.log('Relation utilisateur-recette créée.');

        // 5. Ajouter les instructions à la recette
        for (const instruction of instructions) {
            const createInstructionResult = await session.run(
                'MERGE (i:Instruction {step: $step}) RETURN i',
                { step: instruction.step }
            );

            const instructionNode = createInstructionResult.records[0].get('i');
            const instructionElementId = instructionNode.identity.low;

            await session.run(
                'MATCH (r:Recipe), (i:Instruction) WHERE id(r) = $recipeId AND id(i) = $instructionId ' +
                'MERGE (r)-[:HAS_INSTRUCTION]->(i)',
                { recipeId: newRecipeId, instructionId: instructionElementId }
            );
        }

        // 6. Ajouter les ingrédients à la recette
        for (const ingredient of ingredients) {
            const createIngredientResult = await session.run(
                'MERGE (i:Ingredient {name: $name}) RETURN i',
                { name: ingredient.name }
            );

            const ingredientNode = createIngredientResult.records[0].get('i');
            const ingredientElementId = ingredientNode.identity.low;

            await session.run(
                'MATCH (r:Recipe), (i:Ingredient) WHERE id(r) = $recipeId AND id(i) = $ingredientId ' +
                'MERGE (r)-[:HAS_INGREDIENT]->(i)',
                { recipeId: newRecipeId, ingredientId: ingredientElementId }
            );
        }

        res.status(200).json({
            message: 'Recette créée avec succès',
            recipe: {
                userId, // Assurez-vous que le userId est présent dans la réponse
                title,
                description,
                image,
                instructions,
                ingredients
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création de la recette:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        await session.close();
    }
});








app.delete('/api/recipes/:title', async (req, res) => {
    const { title } = req.params; // Récupérer le titre de la recette

    const session = driver.session();

    try {
        // Supprimer la recette et ses relations en une seule commande avec DETACH DELETE
        await session.run(
            'MATCH (r:Recipe) WHERE r.title = $title DETACH DELETE r',
            { title }
        );

        res.status(200).json({
            message: 'Recette et ses relations supprimées avec succès',
            title
        });
    } catch (error) {
        console.error('Erreur lors de la suppression de la recette:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        session.close();
    }
});



app.get('/api/recipe/:title', async (req, res) => {
    const { title } = req.params;  // Récupérer le titre dans les paramètres de la requête

    const session = driver.session();

    try {
        // Exécute la requête en utilisant le titre
        const result = await session.run(
            `
      MATCH (r:Recipe)-[:HAS_INGREDIENT]->(i:Ingredient),
            (r)-[:HAS_INSTRUCTION]->(inst:Instruction)
      WHERE r.title = $title  // Recherche par titre de la recette
      RETURN r, collect(i) AS ingredients, collect(inst) AS instructions
      `,
            { title }  // Passer le titre en paramètre à la requête
        );

        // Vérifier si des résultats ont été trouvés
        if (result.records.length === 0) {
            return res.status(404).json({ message: 'Recette non trouvée' });
        }

        // Extraire les données de la recette, des ingrédients et des instructions
        const recipe = result.records[0].get('r').properties;
        const ingredients = result.records[0].get('ingredients').map(ingredient => ingredient.properties);
        const instructions = result.records[0].get('instructions').map(instruction => instruction.properties);

        // Retourner la recette avec les détails
        res.status(200).json({
            message: 'Recette récupérée avec succès',
            recipe,
            ingredients,
            instructions,
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la recette:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    } finally {
        session.close();
    }
});


app.get('/api/search', async (req, res) => {
    try {
        let ingredients = req.query.ingredients;

        // Vérifier si 'ingredients' est une chaîne, puis la convertir en tableau
        if (typeof ingredients === 'string') {
            ingredients = ingredients.split(',').map(ingredient => ingredient.trim());
        }

        // Si 'ingredients' est déjà un tableau, le traiter directement
        if (Array.isArray(ingredients)) {
            ingredients = ingredients.map(ingredient => ingredient.trim());
        } else {
            return res.status(400).json({ message: 'Le paramètre "ingredients" est requis et doit être une chaîne ou un tableau.' });
        }

        // Requête Cypher mise à jour pour rechercher les recettes avec au moins un ingrédient commun
        const query = `
            MATCH (r:Recipe)-[:HAS_INGREDIENT]->(i:Ingredient)
            WHERE i.name IN $ingredients
            RETURN DISTINCT r.title AS title, r.image AS image, collect(i.name) AS ingredients
        `;

        // Exécuter la requête
        const result = await session.run(query, { ingredients });

        // Vérifier si des recettes ont été trouvées
        if (result.records.length === 0) {
            return res.status(404).json({ message: 'Aucune recette trouvée pour les ingrédients fournis.' });
        }

        // Mapper les résultats pour envoyer les recettes
        const recipes = result.records.map(record => ({
            title: record.get('title'),
            image: record.get('image'),
            ingredients: record.get('ingredients')
        }));

        res.status(200).json(recipes);

    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des recettes.' });
    }
});










  // Route pour récupérer toutes les recettes, leurs relations et l'utilisateur associé
app.get('/api/recipes', async (req, res) => {
  const session = driver.session();

  try {
    // Requête pour récupérer toutes les recettes, leurs relations, et potentiellement l'utilisateur associé
    const result = await session.run(
        `
        MATCH (r:Recipe)
        OPTIONAL MATCH (u:User)-[:HAS_RECIPE]->(r)
        OPTIONAL MATCH (r)-[:HAS_INSTRUCTION]->(i:Instruction)
        OPTIONAL MATCH (r)-[:HAS_INGREDIENT]->(ing:Ingredient)
        RETURN 
          r, 
          u.userId AS userId, 
          collect(i) AS instructions, 
          collect(ing) AS ingredients
        `
      );
      console.log(result.records);

    // Si aucune recette n'est trouvée
    if (result.records.length === 0) {
      return res.status(404).json({ message: 'Aucune recette trouvée' });
    }

    // Formater les résultats pour chaque recette
    const recipes = result.records.map((record) => {
      const recipeNode = record.get('r');
      const userId = record.get('userId'); // Assigner `null` si aucune relation utilisateur n'existe
      const instructions = record.get('instructions');
      const ingredients = record.get('ingredients');

      // Accéder aux propriétés des instructions et ingrédients
      const formattedInstructions = instructions.map((instruction) => ({
        step: instruction.properties.step,
      }));

      const formattedIngredients = ingredients.map((ingredient) => ({
        name: ingredient.properties.name,
      }));

      return {
        userId, // Inclure l'ID de l'utilisateur ou `null`
        recipeId: recipeNode.properties.recipeId,
        title: recipeNode.properties.title,
        description: recipeNode.properties.description,
        image: recipeNode.properties.image,
        instructions: formattedInstructions,
        ingredients: formattedIngredients,
      };
    });

    // Retourner la liste des recettes avec leurs détails
    res.status(200).json(recipes);

  } catch (error) {
    console.error('Erreur lors de la récupération des recettes:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  } finally {
    // Fermer la session Neo4j
  }
});


const PDFDocument = require('pdfkit');
const fs = require('fs');

app.post('/download-recipe', (req, res) => {
    const { title, description, image, ingredients, instructions } = req.body;

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`);

    // Pipe the PDF to the response stream
    doc.pipe(res);

    // Add content to the PDF
    doc.fontSize(25).text(title, { align: 'center' });
    doc.fontSize(12).text(description);
    doc.text('\nIngredients:');
    ingredients.forEach((ingredient, index) => {
        doc.text(`${index + 1}. ${ingredient}`);
    });

    doc.text('\nInstructions:');
    instructions.forEach((instruction, index) => {
        doc.text(`${index + 1}. ${instruction.step}`);
    });

    // Finalize the PDF and end the response
    doc.end();
});







// Lancer le serveur
const port = 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
