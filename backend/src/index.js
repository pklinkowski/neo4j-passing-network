import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { testNeo4jConnection } from "./services/neo4j.js";
import matchesRouter from "./routes/matches.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/matches", matchesRouter);

app.get("/health", (req, res) => res.json({ ok: true }));

const start = async () => {
  try {
    const ok = await testNeo4jConnection();
    console.log("Neo4j connected, test result:", ok);
    app.listen(config.port, () => console.log("API on port", config.port));
  } catch (err) {
    console.error("Neo4j connection failed:", err);
    process.exit(1);
  }
};

start();
