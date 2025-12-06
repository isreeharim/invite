// src/models/Invitation.js
const mongoose = require("mongoose");
const crypto = require("crypto");

const InvitationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
  hostName: { type: String, trim: true, default: "" },
  eventType: { type: String, trim: true, default: "general" },
  date: { type: Date },
  time: { type: String, trim: true },
  venue: { type: String, trim: true, default: "" },
  message: { type: String, trim: true, default: "" },
  templateName: { type: String, trim: true, default: "classic1" },
  meta: {
    coverImage: { type: String, default: "" },
    themeColor: { type: String, default: "" },
    accessKey: { type: String, default: "" }
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }
}, { timestamps: true });

InvitationSchema.methods.makeSlugFrom = function(source) {
  if (!source) return "";
  return String(source).trim().toLowerCase().replace(/[^a-z0-9\-_\s]/g, "").replace(/\s+/g, "-");
};

InvitationSchema.pre("validate", function(next) {
  if (!this.slug || this.slug.trim() === "") {
    this.slug = this.makeSlugFrom(this.title || "invite");
  } else {
    this.slug = this.makeSlugFrom(this.slug);
  }
  if (!this.meta) this.meta = {};
  if (!this.meta.accessKey) this.meta.accessKey = crypto.randomBytes(6).toString("hex");
  next();
});

InvitationSchema.pre("save", async function(next) {
  if (!this.isModified("slug")) return next();
  const Invitation = mongoose.model("Invitation");
  let base = this.slug;
  let suffix = 0;
  let candidate = base;
  while (true) {
    const existing = await Invitation.findOne({ slug: candidate, _id: { $ne: this._id } }).lean();
    if (!existing) break;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  this.slug = candidate;
  next();
});

InvitationSchema.index({ slug: 1 });

module.exports = mongoose.model("Invitation", InvitationSchema);
