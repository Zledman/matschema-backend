const sendShoppingList = (items = []) => ({
    provider: "COOP",
    checkoutUrl: "https://coop.example/checkout/123",
    items,
  });
module.exports = { sendShoppingList };
