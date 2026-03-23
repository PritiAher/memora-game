const express = require("express");
// Express is a minimal Node.js web framework that lets you define routes,
// handle HTTP requests/responses, and plug in middleware easily.
// Without it, you'd have to use Node's raw `http` module which is verbose.

const cors = require("cors");
// CORS = Cross-Origin Resource Sharing.
// Browsers block requests from a different origin (domain/port) by default.
// This middleware tells the browser "yes, this frontend is allowed to talk to this server".
// Without it, your React app on localhost:5173 can't call this API on localhost:5000.

const dotenv = require("dotenv");
// Loads environment variables from a .env file into process.env.
// This keeps sensitive data (DB passwords, JWT secrets, API keys) out of your source code.
// Example: process.env.MONGO_URI instead of hardcoding the connection string.

const rateLimit = require("express-rate-limit");
// A middleware to limit how many requests a single IP can make in a time window.
// Prevents brute force attacks (e.g. someone trying 10,000 passwords on /login).
// Without this, your API is open to abuse.

const connectDB = require("./config/db");
// Your custom function that establishes the MongoDB connection using Mongoose.
// Kept in a separate file to keep server.js clean and follow separation of concerns.

const authRoutes = require("./routes/authRoutes");
// All routes related to authentication — register, login, logout etc.
// Kept in a separate file so server.js doesn't become one giant file.

const leaderboardRoutes = require("./routes/leaderboardRoutes");
// All routes related to the game leaderboard — fetching scores, submitting scores etc.
// Again, separated by feature/resource for clean code organization.

const errorHandler = require("./middleware/errorHandler");
// A centralized error handling middleware.
// Instead of writing try/catch in every route, errors are passed to this
// single handler using next(error). It formats and sends the error response consistently.

// ─────────────────────────────────────────────────────────────────────────────

// Load env variables
dotenv.config();
// Reads your .env file and loads all key=value pairs into process.env.
// Must be called BEFORE anything that uses process.env (like connectDB or PORT).
// If you call this after, those values will be undefined.

// Connect to MongoDB
connectDB();
// Calls your db.js function to open a Mongoose connection to MongoDB.
// Called at startup so the DB is ready before any requests come in.
// If this fails, your app will log an error and typically exit.

const app = express();
// Creates your Express application instance.
// `app` is the central object — you attach middleware, routes, and start the server on it.

// ── Middleware ────────────────────────────────────────────────────────────────
// Middleware = functions that run on every request BEFORE it reaches your route handler.
// They sit in the middle between the request coming in and the response going out.
// Order matters — middleware runs top to bottom.

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    // Only allows requests from this specific frontend URL.
    // In production, CLIENT_URL would be your deployed frontend domain.
    // Using || means it falls back to localhost:5173 in development if env var is missing.

    credentials: true,
    // Allows cookies and authorization headers to be sent cross-origin.
    // Required if you're using httpOnly cookies for auth tokens.
  })
);

app.use(express.json());
// Parses incoming requests with JSON bodies and makes the data available on req.body.
// Without this, req.body would be undefined when the frontend sends JSON data.
// Example: POST /login sends { email, password } → this middleware parses it into req.body.

// Rate limiting — max 100 requests per 15 min per IP
// Protects against brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Time window in milliseconds. 15 * 60 * 1000 = 15 minutes.
  // All request counts reset after this window expires.

  max: 100,
  // Maximum number of requests allowed per IP within the window.
  // After 100 requests, the IP gets blocked until the window resets.

  message: { message: "Too many requests, please try again later" },
  // The JSON response sent back when the limit is exceeded (HTTP 429 Too Many Requests).
});
app.use("/api", limiter);
// Applies the general rate limiter to ALL /api routes.
// So any endpoint under /api is protected — leaderboard, health check etc.

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Same 15 minute window
  max: 10,
  // Much stricter — only 10 attempts per 15 min.
  // Login/register are high-value targets for brute force attacks.
  // 10 attempts is generous for a real user but low enough to block bots.

  message: { message: "Too many auth attempts, please try again later" },
});
app.use("/api/auth", authLimiter);
// Applies the stricter auth limiter specifically to /api/auth routes.
// Note: /api/auth requests hit BOTH limiters (general + auth) since both match.
// The auth limiter is more restrictive so it effectively overrides the general one.

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
// Mounts the auth router at /api/auth.
// Any route defined in authRoutes.js as "/" becomes "/api/auth/",
// "/login" becomes "/api/auth/login" etc.

app.use("/api/leaderboard", leaderboardRoutes);
// Mounts the leaderboard router at /api/leaderboard.
// Same pattern — routes inside leaderboardRoutes.js are prefixed with /api/leaderboard.

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Memora API is running 🔮" });
});
// A simple endpoint to verify the server is alive and running.
// Commonly used by deployment platforms (Railway, Render, AWS) to check if
// the app is healthy. If this returns 200, the server is up.
// Also useful for your own debugging — quick sanity check without a full DB call.

app.use("*", (req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});
// Catch-all handler for any route that doesn't match the ones defined above.
// The "*" wildcard matches everything that wasn't caught earlier.
// Returns a clean 404 JSON instead of Express's default HTML error page.
// Must come AFTER all your real routes — otherwise it would catch everything.

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);
// Centralized error handler — must be defined LAST, after all routes and middleware.
// Express identifies it as an error handler because it has 4 parameters: (err, req, res, next).
// When any route calls next(error), Express skips all normal middleware and
// jumps straight to this handler. Keeps error handling DRY across the whole app.

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
// Reads the port from environment variables.
// In production (Railway, Render etc.), the platform assigns a PORT dynamically.
// Falls back to 5000 for local development if PORT isn't set in .env.

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
// Starts the HTTP server and begins listening for incoming requests on the given port.
// The callback fires once the server is successfully up — good place for a startup log.
// From this point, your API is live and ready to accept requests.