const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String },
    seasonTags: [{ type: String }],
    pricePerStore: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ingredient", ingredientSchema);
