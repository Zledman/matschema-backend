const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    preferences: { type: mongoose.Schema.Types.Mixed },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    activeTokenJtis: { type: [String], default: [] },
    activeRefreshTokenJtis: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Virtuellt fält: password (används bara vid skapande / uppdatering)
userSchema
  .virtual("password")
  .set(function (password) {
    this._plainPassword = password;
  })
  .get(function () {
    return this._plainPassword;
  });

// Hashing innan validering så att passwordHash finns vid required-check
userSchema.pre("validate", async function (next) {
  if (
    this._plainPassword &&
    (this.isNew || this.isModified("_plainPassword"))
  ) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.passwordHash = await bcrypt.hash(this._plainPassword, salt);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Metod: jämför plaintext-lösenord
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
