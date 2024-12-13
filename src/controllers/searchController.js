import client from "../config/hbaseConfig.js";

export const searchRecipes = async (req, res) => {
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

        // Construire une requête HBase pour rechercher des recettes avec des ingrédients
        const table = client.table('recipes');
        const ingredientsKey = ingredients.join('|'); // Assumption: use a composite key for searching

        const rows = await table.getRow(ingredientsKey);
        
        // Vérifier si des recettes ont été trouvées
        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: 'Aucune recette trouvée pour les ingrédients fournis.' });
        }

        // Mapper les résultats pour envoyer les recettes
        const recipes = rows.map(row => ({
            title: row.title,
            image: row.image,
            ingredients: row.ingredients.split('|') // Assumption: ingredients stored as a string separated by '|'
        }));

        res.status(200).json(recipes);

    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des recettes.' });
    }
};


