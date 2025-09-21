const sendShoppingList = (items = []) => ({
    provider: "CityGross",
    checkoutUrl: "https://citygross.example/checkout/123",
    items,
  });
module.exports = { sendShoppingList };
