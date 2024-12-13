import PDFDocument from 'pdfkit';

export const downloadRecipe = (req, res) => {
    const { title, description, image, ingredients, instructions } = req.body;

    try {
        const doc = new PDFDocument();
        
        // Set response headers for PDF download
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
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'An error occurred while generating the PDF.' });
    }
};
