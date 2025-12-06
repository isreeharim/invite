// src/routes/user.js
const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");

function ensureAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect("/login");
}

router.get("/dashboard", ensureAuth, async (req, res) => {
  const invites = await Invitation.find({ owner: req.session.userId }).sort({ createdAt: -1 }).lean();
  res.render("user_dashboard", { invites });
});

router.get("/invites/new", ensureAuth, (req, res) => res.render("user_invite_new", { error: null, values: {} }));

router.post("/invites/new", ensureAuth, async (req, res) => {
  try {
    const { title, slug, hostName, eventType, date, time, venue, message, templateName, coverImage, themeColor } = req.body;
    const invitation = new Invitation({ title, slug, hostName, eventType, date: date ? new Date(date) : null, time, venue, message, templateName, meta: { coverImage, themeColor }, owner: req.session.userId });
    await invitation.save();
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(400).render("user_invite_new", { error: err.message || "Error", values: req.body });
  }
});

router.get("/invites/edit/:id", ensureAuth, async (req, res) => {
  const inv = await Invitation.findById(req.params.id).lean();
  if (!inv) return res.status(404).send("Not found");
  if (!inv.owner || String(inv.owner) !== String(req.session.userId)) return res.status(403).send("Forbidden");
  res.render("user_invite_edit", { invite: inv });
});

router.post("/invites/edit/:id", ensureAuth, async (req, res) => {
  const inv = await Invitation.findById(req.params.id);
  if (!inv) return res.status(404).send("Not found");
  if (!inv.owner || String(inv.owner) !== String(req.session.userId)) return res.status(403).send("Forbidden");
  const { title, slug, hostName, eventType, date, time, venue, message, templateName, coverImage, themeColor } = req.body;
  inv.title = title; inv.slug = slug; inv.hostName = hostName; inv.eventType = eventType;
  inv.date = date ? new Date(date) : null; inv.time = time; inv.venue = venue; inv.message = message; inv.templateName = templateName;
  inv.meta.coverImage = coverImage; inv.meta.themeColor = themeColor;
  await inv.save();
  res.redirect("/dashboard");
});

router.post("/invites/delete/:id", ensureAuth, async (req, res) => {
  const inv = await Invitation.findById(req.params.id);
  if (!inv) return res.status(404).send("Not found");
  if (!inv.owner || String(inv.owner) !== String(req.session.userId)) return res.status(403).send("Forbidden");
  await Invitation.findByIdAndDelete(req.params.id);
  res.redirect("/dashboard");
});

module.exports = router;
