// src/routes/admin.js
const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");
const User = require("../models/User");

// ensure admin
async function ensureAdmin(req, res, next) {
  try {
    if (!req.session || !req.session.userId) return res.redirect("/login");
    const user = await User.findById(req.session.userId).lean();
    if (!user || user.role !== "admin") return res.status(403).send("Forbidden - Admins only");
    req.adminUser = user;
    return next();
  } catch (err) {
    console.error("ensureAdmin error:", err);
    return res.status(500).send("Server error");
  }
}

// index
router.get("/", ensureAdmin, async (req, res) => {
  try {
    const invites = await Invitation.find().sort({ createdAt: -1 }).limit(50).populate("owner", "name email").lean();
    const users = await User.find().sort({ createdAt: -1 }).limit(50).lean();
    res.render("admin_index", { invites, users });
  } catch (err) {
    console.error("Admin index error:", err);
    res.status(500).send("Server error");
  }
});

// list all invites
router.get("/invitations", ensureAdmin, async (req, res) => {
  try {
    const invitations = await Invitation.find().sort({ createdAt: -1 }).populate("owner", "name email").lean();
    res.render("admin_list", { invitations });
  } catch (err) {
    console.error("Admin invitations error:", err);
    res.status(500).send("Server error");
  }
});

// edit get
router.get("/edit/:id", ensureAdmin, async (req, res) => {
  try {
    const invite = await Invitation.findById(req.params.id).lean();
    if (!invite) return res.status(404).send("Invitation not found");
    const clientUrl = `/client/${invite.slug}/${invite.meta?.accessKey || ""}`;
    res.render("admin_edit", { invite, clientUrl });
  } catch (err) {
    console.error("Admin edit GET error:", err);
    res.status(500).send("Server error");
  }
});

// edit post
router.post("/edit/:id", ensureAdmin, async (req, res) => {
  try {
    const { title, slug, hostName, eventType, date, time, venue, message, templateName, coverImage, themeColor } = req.body;
    const update = { title, slug, hostName, eventType, date: date ? new Date(date) : null, time, venue, message, templateName, "meta.coverImage": coverImage, "meta.themeColor": themeColor };
    await Invitation.findByIdAndUpdate(req.params.id, update, { runValidators: true });
    res.redirect("/admin/invitations");
  } catch (err) {
    console.error("Admin edit POST error:", err);
    res.status(400).send("Update failed: " + (err.message || ""));
  }
});

// delete invite
router.post("/delete/:id", ensureAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    await Invitation.findByIdAndDelete(id);
    res.redirect("/admin/invitations");
  } catch (err) {
    console.error("Admin invitation delete error:", err);
    res.status(500).send("Delete failed");
  }
});

// users list
router.get("/users", ensureAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.render("admin_users", { users });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).send("Server error");
  }
});

// delete user
router.post("/user/delete/:id", ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect("back");
  } catch (err) {
    console.error("Admin user delete error:", err);
    res.status(500).send("Delete failed");
  }
});

// promote user
router.post("/user/promote/:id", ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { role: "admin" });
    res.redirect("back");
  } catch (err) {
    console.error("Admin user promote error:", err);
    res.status(500).send("Change role failed");
  }
});

// Admin: demote user (make admin -> user) — protected
router.post("/user/demote/:id", ensureAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;

    // fetch the target user
    const target = await User.findById(targetId).lean();
    if (!target) {
      console.warn("Attempt to demote non-existent user:", targetId);
      return res.redirect("back");
    }

    // 1) protect the configured "real admin" (ADMIN_EMAIL in .env)
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    if (adminEmail && target.email && target.email.toLowerCase() === adminEmail) {
      console.warn("Blocked demotion of real admin account:", adminEmail);
      return res.status(400).send("Cannot demote the primary admin account.");
    }

    // 2) prevent demoting yourself (so admin doesn't lock themselves out)
    if (req.session && String(req.session.userId) === String(targetId)) {
      console.warn("Blocked self-demotion for user:", targetId);
      return res.status(400).send("You cannot demote yourself.");
    }

    // 3) ensure at least one admin remains — count current admins
    const adminCount = await User.countDocuments({ role: "admin" });
    // If there's only one admin left, blocking demotion
    if (adminCount <= 1) {
      console.warn("Blocked demotion: only one admin remains.");
      return res.status(400).send("Cannot demote the last remaining admin.");
    }

    // All checks passed — demote the user
    await User.findByIdAndUpdate(targetId, { role: "user" });
    return res.redirect("back");
  } catch (err) {
    console.error("Admin user demote error:", err);
    return res.status(500).send("Change role failed");
  }
});


module.exports = router;
