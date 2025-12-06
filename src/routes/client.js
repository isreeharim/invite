// src/routes/client.js
const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");

// Client direct URL: view dashboard
// /client/:slug/:accessKey
router.get("/client/:slug/:accessKey", async (req, res) => {
  try {
    const { slug, accessKey } = req.params;
    const invite = await Invitation.findOne({ slug, "meta.accessKey": accessKey }).lean();

    if (!invite) return res.status(404).render("client_not_found");

    res.render("client_dashboard", { invite, message: null, error: null });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Client updates allowed fields (POST)
router.post("/client/:slug/:accessKey", async (req, res) => {
  try {
    const { slug, accessKey } = req.params;
    const invite = await Invitation.findOne({ slug, "meta.accessKey": accessKey });
    if (!invite) return res.status(404).render("client_not_found");

    // Allow limited updates only
    const { title, date, time, venue, message, coverImage, themeColor } = req.body;

    invite.title = title || invite.title;
    invite.date = date ? new Date(date) : invite.date;
    invite.time = time || invite.time;
    invite.venue = venue || invite.venue;
    invite.message = message || invite.message;
    invite.meta.coverImage = coverImage || invite.meta.coverImage;
    invite.meta.themeColor = themeColor || invite.meta.themeColor;

    await invite.save();

    res.render("client_dashboard", { invite: invite.toObject(), message: "Saved successfully", error: null });
  } catch (err) {
    console.error(err);
    res.status(400).render("client_dashboard", { invite: null, message: null, error: err.message || "Save failed" });
  }
});

module.exports = router;
