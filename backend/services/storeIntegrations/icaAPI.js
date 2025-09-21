const sendShoppingList = (items = []) => ({
    provider: "ICA",
    checkoutUrl: "https://ica.example/checkout/123",
    items,
  });
module.exports = { sendShoppingList };
