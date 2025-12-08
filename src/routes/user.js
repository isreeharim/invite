// src/routes/user.js
const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");
const multer = require("multer");
const uploadBufferToCloudinary = require("../lib/uploadToCloudinary");

// simple multer memory storage (we stream to Cloudinary; nothing written to disk)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Middleware: ensure auth
function ensureAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect("/login");
}

// Dashboard
router.get("/dashboard", ensureAuth, async (req, res) => {
  const invites = await Invitation.find({ owner: req.session.userId }).sort({ createdAt: -1 }).lean();
  res.render("user_dashboard", { invites });
});

// Create invite form
router.get("/invites/new", ensureAuth, (req, res) => {
  res.render("user_invite_new", { error: null, values: {} });
});

// Handle create invite (accept optional file)
router.post("/invites/new", ensureAuth, upload.single("coverImage"), async (req, res) => {
  try {
    const {
      title, slug, hostName, eventType,
      date, time, venue, message, templateName, themeColor
    } = req.body;

    const invitationData = {
      title, slug, hostName, eventType,
      date: date ? new Date(date) : null,
      time, venue, message, templateName,
      meta: { themeColor },
      owner: req.session.userId
    };

    // If file uploaded, upload to Cloudinary
    if (req.file && req.file.buffer) {
      // optional: set folder and public_id (e.g. "invites/<slug>-<timestamp>")
      const publicId = `invites/${(slug || title || "invite").toString().replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`;
      const result = await uploadBufferToCloudinary(req.file.buffer, { folder: "invites", public_id: publicId, resource_type: "image", overwrite: true, format: "jpg" });
      invitationData.meta.coverImage = result.secure_url;
      // optional: store result.public_id if you want to delete later
      invitationData.meta.coverImageId = result.public_id;
    } else if (req.body.coverImage && req.body.coverImage.trim()) {
      // fallback: user typed a URL (keep backward compatibility)
      invitationData.meta.coverImage = req.body.coverImage.trim();
    }

    const invitation = new Invitation(invitationData);
    await invitation.save();
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Create invite error:", err);
    res.status(400).render("user_invite_new", { error: err.message || "Error", values: req.body });
  }
});

// Edit invite (only owner) — show form
router.get("/invites/edit/:id", ensureAuth, async (req, res) => {
  const inv = await Invitation.findById(req.params.id).lean();
  if (!inv) return res.status(404).send("Not found");
  if (!inv.owner || String(inv.owner) !== String(req.session.userId)) return res.status(403).send("Forbidden");
  res.render("user_invite_edit", { invite: inv });
});

// Handle edit (accept optional new file)
router.post("/invites/edit/:id", ensureAuth, upload.single("coverImage"), async (req, res) => {
  try {
    const inv = await Invitation.findById(req.params.id);
    if (!inv) return res.status(404).send("Not found");
    if (!inv.owner || String(inv.owner) !== String(req.session.userId)) return res.status(403).send("Forbidden");

    const {
      title, slug, hostName, eventType,
      date, time, venue, message, templateName, themeColor
    } = req.body;

    inv.title = title;
    inv.slug = slug;
    inv.hostName = hostName;
    inv.eventType = eventType;
    inv.date = date ? new Date(date) : null;
    inv.time = time;
    inv.venue = venue;
    inv.message = message;
    inv.templateName = templateName;
    if (!inv.meta) inv.meta = {};
    inv.meta.themeColor = themeColor;

    // If file uploaded, upload to Cloudinary and update coverImage
    if (req.file && req.file.buffer) {
      const publicId = `invites/${(slug || title || "invite").toString().replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`;
      const result = await uploadBufferToCloudinary(req.file.buffer, { folder: "invites", public_id: publicId, resource_type: "image", overwrite: true, format: "jpg" });
      inv.meta.coverImage = result.secure_url;
      inv.meta.coverImageId = result.public_id;
    } else if (req.body.coverImage && req.body.coverImage.trim()) {
      // keep manual URL if provided
      inv.meta.coverImage = req.body.coverImage.trim();
    }

    await inv.save();
    res.redirect("/dashboard");
  } catch (err) {
    console.error("Edit invite error:", err);
    res.status(400).render("user_invite_edit", { invite: await Invitation.findById(req.params.id).lean(), error: err.message });
  }
});

// Delete invite
router.post("/invites/delete/:id", ensureAuth, async (req, res) => {
  const inv = await Invitation.findById(req.params.id);
  if (!inv) return res.status(404).send("Not found");
  if (!inv.owner || String(inv.owner) !== String(req.session.userId)) return res.status(403).send("Forbidden");

  // Optional: delete image from Cloudinary if meta.coverImageId exists
  // (we don't require it, but you can enable deletion below)
  /*
  try {
    const cloudinary = require("../lib/cloudinary");
    if (inv.meta && inv.meta.coverImageId) {
      await cloudinary.uploader.destroy(inv.meta.coverImageId, { resource_type: 'image' });
    }
  } catch (e) { console.warn("Failed to delete cloudinary resource", e); }
  */

  await Invitation.findByIdAndDelete(req.params.id);
  res.redirect("/dashboard");
});

module.exports = router;
