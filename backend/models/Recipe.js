const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    instructions: { type: String },
    category: { type: String },
    seasonTags: [{ type: String }],
    priceLevel: { type: String },
    ingredients: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Recipe", recipeSchema);
