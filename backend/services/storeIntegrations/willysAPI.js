const sendShoppingList = (items = []) => ({
    provider: "Willys",
    checkoutUrl: "https://willys.example/checkout/123",
    items,
  });
module.exports = { sendShoppingList };
