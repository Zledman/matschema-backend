const getShoppingList = (req, res) => res.status(200).json({ message: "Hämtar inköpslista (dummy)" });

const sendShoppingList = (req, res) => res.status(200).json({ message: "Skickar inköpslista (dummy)" });

module.exports = { getShoppingList, sendShoppingList };
