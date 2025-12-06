// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");

const app = express();

// Basic middleware & view engine
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// connect-mongo detection
let ConnectMongoPackage = null;
try {
  ConnectMongoPackage = require("connect-mongo");
} catch (e) {
  ConnectMongoPackage = null;
}

async function buildStore() {
  if (ConnectMongoPackage && typeof ConnectMongoPackage.create === "function") {
    console.log("Using modern connect-mongo (create) session store");
    return ConnectMongoPackage.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions"
    });
  }
  if (typeof ConnectMongoPackage === "function") {
    console.log("Using legacy connect-mongo (function) session store");
    const LegacyStore = ConnectMongoPackage(session);
    return new LegacyStore({
      mongooseConnection: mongoose.connection,
      collection: "sessions"
    });
  }
  if (ConnectMongoPackage && typeof ConnectMongoPackage.default === "function") {
    console.log("Using legacy connect-mongo (default function) session store");
    const LegacyStore = ConnectMongoPackage.default(session);
    return new LegacyStore({
      mongooseConnection: mongoose.connection,
      collection: "sessions"
    });
  }
  if (ConnectMongoPackage && ConnectMongoPackage.default && typeof ConnectMongoPackage.default.create === "function") {
    console.log("Using modern connect-mongo via default.create");
    return ConnectMongoPackage.default.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions"
    });
  }
  throw new Error("connect-mongo not usable. Install a compatible version: npm install connect-mongo@^4.0.0");
}

// Initialize server (await store)
(async function init() {
  try {
    const store = await buildStore();

    app.use(session({
      secret: process.env.SESSION_SECRET || "devsecret",
      resave: false,
      saveUninitialized: false,
      store: store,
      cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
    }));

    // make currentUser available in views
    const User = require("./src/models/User");
    app.use(async (req, res, next) => {
      res.locals.currentUser = null;
      if (req.session && req.session.userId) {
        try {
          const user = await User.findById(req.session.userId).lean();
          res.locals.currentUser = user || null;
        } catch (err) {
          res.locals.currentUser = null;
        }
      }
      next();
    });

    // routes
    const authRoutes = require("./src/routes/auth");
    const adminRoutes = require("./src/routes/admin");
    const publicRoutes = require("./src/routes/public");
    const userRoutes = require("./src/routes/user");

    app.use(authRoutes);
    app.use("/admin", adminRoutes);
    app.use(publicRoutes);
    app.use(userRoutes);

    // root
    app.get("/", (req, res) => res.render("home"));

    // ensure admin user exists if env provided
    (async function ensureAdmin() {
      try {
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        const ADMIN_PASS = process.env.ADMIN_PASS;
        if (!ADMIN_EMAIL || !ADMIN_PASS) return;
        const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
        if (!existing) {
          const u = new User({ name: "Admin", email: ADMIN_EMAIL.toLowerCase(), role: "admin" });
          await u.setPassword(ADMIN_PASS);
          await u.save();
          console.log("✅ Admin user created:", ADMIN_EMAIL);
        } else {
          if (existing.role !== "admin") {
            existing.role = "admin";
            await existing.save();
            console.log("✅ Promoted existing user to admin:", ADMIN_EMAIL);
          } else {
            console.log("✅ Admin exists:", ADMIN_EMAIL);
          }
        }
      } catch (err) {
        console.error("Admin creation error:", err);
      }
    })();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  } catch (err) {
    console.error("Server initialization failed:", err.message || err);
    process.exit(1);
  }
})();
