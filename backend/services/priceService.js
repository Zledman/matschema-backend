const comparePrices = (items = []) => items.map((i) => ({ name: i, bestPrice: Math.random().toFixed(2) }));

module.exports = { comparePrices };
