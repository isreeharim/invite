// src/routes/public.js
const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");

// Public invite page (no RSVP)
router.get("/i/:slug", async (req, res) => {
  try {
    const invite = await Invitation.findOne({ slug: req.params.slug }).lean();
    if (!invite) return res.status(404).render("invite_not_found", { slug: req.params.slug });
    return res.render("invite_classic1", { invite, request: req });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
