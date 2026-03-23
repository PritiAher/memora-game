const mongoose = require("mongoose");
// Mongoose is an ODM (Object Document Mapper) for MongoDB.
// It lets you define schemas (structure + rules) for your MongoDB documents,
// instead of storing raw unstructured JSON. Think of it as adding a type system to MongoDB.

const bcrypt = require("bcryptjs");
// A library for hashing passwords securely.
// Hashing is a one-way process — you can never reverse a hash back to the original password.
// bcryptjs is the pure JavaScript version of bcrypt (no native dependencies — easier to install).

// ── User Schema ───────────────────────────────────────────────────────────────
// A schema defines the structure, data types, and validation rules
// for documents stored in the MongoDB "users" collection.
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,           
      // Must be a string value

      required: [true, "Username is required"],  
      // Makes this field mandatory.
      // [true, "message"] — second element is the custom error message on validation failure.

      unique: true,           
      // No two users can have the same username.
      // Mongoose creates a unique index on this field in MongoDB.

      trim: true,             
      // Automatically strips leading/trailing whitespace before saving.
      // So "  priti  " becomes "priti".

      minlength: [3, "Username must be at least 3 characters"],
      // Rejects usernames shorter than 3 characters with this error message.

      maxlength: [20, "Username cannot exceed 20 characters"],
      // Rejects usernames longer than 20 characters with this error message.
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,           
      // No two users can register with the same email address.

      trim: true,
      lowercase: true,        
      // Automatically converts email to lowercase before saving.
      // So "PRITI@Gmail.COM" and "priti@gmail.com" are treated as the same email.

      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
      // Regex validation — checks if the email has the basic format: something@something.something
      // \S+ means one or more non-whitespace characters.
      // Rejects values like "notanemail" or "missing@dotcom".
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],

      select: false,
      // CRITICAL — this means password is NEVER returned in query results by default.
      // So User.find() or User.findById() will NOT include the password field in the response.
      // Prevents accidentally leaking hashed passwords in API responses.
      // To explicitly fetch it when needed (e.g. login): User.findById(id).select("+password")
    },

    avatar: {
      type: String,
      default: "",
      // Optional field — stores an emoji or initials string for the user's avatar.
      // Defaults to an empty string if not provided during registration.
    },
  },
  {
    timestamps: true,
    // Automatically adds two fields to every document:
    // createdAt — the exact time the user registered
    // updatedAt — the exact time the user document was last modified
    // Mongoose manages these automatically — you never set them manually.
  }
);

// ── Pre-save Hook — Hash password before saving ───────────────────────────────
// Mongoose middleware that runs automatically BEFORE every .save() call.
// This ensures the plain text password is NEVER stored in the database.
userSchema.pre("save", async function (next) {
  // "pre" = runs before the operation
  // "save" = the trigger — fires on both User.create() and user.save()
  // Regular function (not arrow function) is used here intentionally —
  // arrow functions don't have their own `this`, so we need `this` to
  // refer to the current user document being saved.

  if (!this.isModified("password")) return next();
  // this.isModified("password") checks if the password field was actually changed.
  // If the user is only updating their username or email, we skip re-hashing.
  // Without this check, an already-hashed password would get hashed AGAIN on every save,
  // making it impossible to ever verify correctly at login.

  const salt = await bcrypt.genSalt(10);
  // A salt is random data added to the password before hashing.
  // It ensures two users with the same password get completely different hashes.
  // 10 is the "cost factor" — how many rounds of processing bcrypt applies.
  // Higher = more secure but slower. 10 is the industry standard sweet spot.
  // At 10 rounds, hashing takes ~100ms — fast for a real user, painfully slow for an attacker
  // trying millions of combinations.

  this.password = await bcrypt.hash(this.password, salt);
  // Replaces the plain text password with the bcrypt hash.
  // "mypassword123" becomes something like "$2a$10$N9qo8uLOickgx2ZMRZo..."
  // This hashed string is what actually gets stored in MongoDB — never the original.

  next();
  // Tells Mongoose "middleware is done, go ahead and save the document now."
  // Always call next() at the end, otherwise the request hangs forever.
});

// ── Instance Method — Compare passwords at login ──────────────────────────────
// Instance methods are available on every individual user document.
// Called as: const isMatch = await user.matchPassword("enteredPassword")
userSchema.methods.matchPassword = async function (enteredPassword) {
  // `this` refers to the specific user document this method is called on.
  // So this.password is the hashed password stored in the DB for that user.

  return await bcrypt.compare(enteredPassword, this.password);
  // bcrypt.compare takes:
  //   1. enteredPassword — the plain text password the user typed at login
  //   2. this.password   — the stored hash from MongoDB
  // It internally hashes the entered password the same way and checks if they match.
  // Returns true if they match, false if they don't.
  // You CANNOT compare these as plain strings —
  // "mypassword123" !== "$2a$10$N9qo8uLOickgx2..." so bcrypt handles this correctly.
};

// ── Export the model ──────────────────────────────────────────────────────────
module.exports = mongoose.model("User", userSchema);
// Creates a Mongoose model called "User" from the schema above.
// Mongoose automatically maps this to a MongoDB collection called "users"
// (lowercased + pluralized version of the model name — "User" → "users").
// This is what you import in your controllers and use like:
// const User = require("../models/User")
// User.find()        → get all users
// User.findById(id)  → get one user
// User.create({...}) → create a new user (triggers the pre-save hook automatically)
// new User({...})    → instantiate without saving yet