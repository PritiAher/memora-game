const mongoose = require("mongoose");
// Mongoose is an ODM (Object Document Mapper) for MongoDB.
// Used here to define the schema and create the Score model.

// ── Score Schema ──────────────────────────────────────────────────────────────
// Defines the structure of a single game score entry stored in the
// MongoDB "scores" collection. Every time a user completes a game,
// a new Score document is created and saved.
const scoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      // ObjectId is MongoDB's built-in unique identifier type.
      // Every document in MongoDB has an _id field of this type.
      // Here it stores a reference (foreign key equivalent) to a User document.

      ref: "User",
      // Tells Mongoose this ObjectId points to the "User" model.
      // This enables .populate("user") in queries — which replaces the
      // raw ObjectId with the actual user document (username, avatar etc.)
      // Example without populate: { user: "64abc123..." }
      // Example with populate:    { user: { username: "priti", avatar: "🎮" } }

      required: true,
      // Every score must be linked to a user — anonymous scores are not allowed.
    },

    score: {
      type: Number,
      required: true,
      min: 0,
      // Score can't be negative. A completed game always has a score >= 0.
      // The actual score value is calculated on the frontend based on
      // time taken, moves used, and stars earned.
    },

    moves: {
      type: Number,
      required: true,
      min: 1,
      // Number of card flips the user made during the game.
      // Minimum is 1 because you need at least one move to play.
      // Lower moves = better performance = higher score.
    },

    seconds: {
      type: Number,
      required: true,
      min: 0,
      // Total time taken to complete the game in seconds.
      // 0 is technically allowed (edge case safety) but realistically always > 0.
      // Lower seconds = faster completion = higher score.
    },

    stars: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
      // Star rating awarded at the end of the game — between 1 and 3.
      // Typically calculated based on moves and time:
      // 3 stars = excellent, 2 stars = good, 1 star = completed.
      // Enforcing min: 1 ensures even the worst run gets at least 1 star.
    },
  },
  {
    timestamps: true,
    // Automatically adds two fields to every score document:
    // createdAt — the exact time this score was submitted
    // updatedAt — the time it was last modified (rarely changes for scores)
    // Useful for showing "played 2 hours ago" on the leaderboard.
  }
);

// ── Compound Index for fast leaderboard queries ───────────────────────────────
// An index tells MongoDB to pre-sort and organize data on these fields,
// so queries don't have to scan every document in the collection.
// Without an index, leaderboard queries would get slower as scores pile up (full collection scan).
// With an index, MongoDB jumps directly to the right data — O(log n) instead of O(n).
scoreSchema.index({ score: -1, moves: 1 });
//Index DB
// This is a COMPOUND index — it covers two fields together:
//   score: -1 → sort by score in DESCENDING order (highest score first)
//   moves: 1  → then sort by moves in ASCENDING order (fewest moves first) as a tiebreaker
// This exactly matches how a leaderboard is queried:
// "Give me the top scores, and for equal scores, rank the player who used fewer moves higher."
// Having this index means that query is lightning fast, even with thousands of score entries.

module.exports = mongoose.model("Score", scoreSchema);
// Creates a Mongoose model called "Score" from the schema above.
// Mongoose automatically maps this to a MongoDB collection called "scores"
// (lowercased + pluralized — "Score" → "scores").
// Import and use in your controllers like:
// const Score = require("../models/Score")
// Score.find()                          → get all scores
// Score.find().sort({ score: -1 })      → leaderboard query (uses the index above)
// Score.create({ user, score, moves, seconds, stars }) → save a new game result
// Score.find({ user: userId })          → get all scores for a specific user