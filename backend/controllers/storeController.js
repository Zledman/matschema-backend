const getStores = (req, res) => res.status(200).json({ message: "Hämtar butiker (dummy)" });

const sendToStore = (req, res) => res.status(200).json({ message: "Skickar till butik (dummy)" });

module.exports = { getStores, sendToStore };
