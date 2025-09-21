const sendShoppingList = (items = []) => ({
    provider: "Mathem",
    checkoutUrl: "https://mathem.example/checkout/123",
    items,
  });
module.exports = { sendShoppingList };
