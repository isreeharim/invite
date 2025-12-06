// src/routes/auth.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Show signup
router.get("/signup", (req, res) => res.render("auth_signup", { error: null, values: {} }));

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, password2 } = req.body;
    if (!email || !password) return res.status(400).render("auth_signup", { error: "Email and password required", values: req.body });
    if (password !== password2) return res.status(400).render("auth_signup", { error: "Passwords do not match", values: req.body });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).render("auth_signup", { error: "Email already in use", values: req.body });

    const user = new User({ name: name || email.split("@")[0], email });
    await user.setPassword(password);
    await user.save();

    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).render("auth_signup", { error: "Signup failed", values: req.body });
  }
});

// Show login
router.get("/login", (req, res) => res.render("auth_login", { error: null, values: {} }));

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user) return res.status(400).render("auth_login", { error: "Invalid credentials", values: req.body });
    const ok = await user.validatePassword(password);
    if (!ok) return res.status(400).render("auth_login", { error: "Invalid credentials", values: req.body });

    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).render("auth_login", { error: "Login failed", values: req.body });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
