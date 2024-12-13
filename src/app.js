// Importation des dépendances
const express = require('express');
const neo4j = require('neo4j-driver');
const app = express();
const port = 3000;


const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'dinaelhyate@1234')
);

app.get('/users', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run('MATCH (u:User) RETURN u.username AS username');
        
        const usernames = result.records.map(record => record.get('username'));
        
        res.json({ usernames });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Something went wrong while fetching users.', details: error.message });
    } finally {
        await session.close();
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
