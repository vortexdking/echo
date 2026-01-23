import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;
app.post("/auth/anonymous", async (req, res) => {
  const { secret } = req.body;
  if (!secret) return res.status(400).json({ error: "secret_required" });

  // simple anon user object
  res.json({
    id: secret,
    username: "Anon_" + secret.slice(-4),
    color: "#6366f1"
  });
});
app.post("/votes", async (req, res) => {
  res.json({ ok: true });
});

// Use Supabase connection string in DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.get("/health", (req, res) => res.json({ ok: true }));

// List signals
app.get("/signals", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "select id, title, body, category as cat, author, extract(epoch from created_at)*1000 as time from signals order by id desc limit 200"
    );

    // Your frontend expects: {id, title, body, cat, time, replies: []}
    const shaped = rows.map(r => ({
      id: String(r.id),
      title: r.title,
      body: r.body,
      cat: r.cat,
      author: r.author || "Anonymous",
      time: Number(r.time),
      replies: [],
      upvotes: 0,
      votedBy: []
    }));

    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: "db_error", details: String(e) });
  }
});

// Create signal
app.post("/signals", async (req, res) => {
  try {
    const { title, body, category, authorId } = req.body;
    if (!title || !body || !category) {
      return res.status(400).json({ error: "missing_fields" });
    }

    await pool.query(
      "insert into signals (title, body, category, author) values ($1,$2,$3,$4)",
      [title, body, category, authorId || "Anonymous"]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db_error", details: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
  res.send("Echo API is running ✅ Try /health or /signals");
});

app.listen(PORT, () => console.log("API listening on", PORT));
