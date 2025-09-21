const generateMenu = (req, res) => res.status(200).json({ message: "Genererar meny (dummy)" });

const getMenu = (req, res) => res.status(200).json({ message: "Hämtar meny (dummy)" });

module.exports = { generateMenu, getMenu };
