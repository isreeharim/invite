// src/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "" },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" }
}, { timestamps: true });

UserSchema.methods.setPassword = async function(raw) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(String(raw), salt);
};

UserSchema.methods.validatePassword = async function(raw) {
  return bcrypt.compare(String(raw), this.passwordHash);
};

module.exports = mongoose.model("User", UserSchema);
