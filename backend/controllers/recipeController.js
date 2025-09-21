const createRecipe = (req, res) => res.status(200).json({ message: "Skapar recept (dummy)" });

const getRecipes = (req, res) => res.status(200).json({ message: "Hämtar recept (dummy)" });

const updateRecipe = (req, res) => res.status(200).json({ message: "Uppdaterar recept (dummy)" });

const deleteRecipe = (req, res) => res.status(200).json({ message: "Tar bort recept (dummy)" });

module.exports = { createRecipe, getRecipes, updateRecipe, deleteRecipe };
