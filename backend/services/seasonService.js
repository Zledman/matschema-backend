const isInSeason = (ingredient, _month = new Date().getMonth() + 1) => true; // dummy
const getSeasonalIngredients = (_month = new Date().getMonth() + 1) => [
  "apple",
  "carrot",
];

module.exports = { isInSeason, getSeasonalIngredients };
