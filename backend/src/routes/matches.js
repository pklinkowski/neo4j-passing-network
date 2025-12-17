import express from "express";
import multer from "multer";
import neo4j from "neo4j-driver";
import { importMatch } from "../services/importMatch.js";
import { driver } from "../services/neo4j.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded (field name: file)" });

  const original = req.file.originalname;   
  const matchId = original.replace(/\.json$/i, "");

  try {
    const raw = req.file.buffer.toString("utf-8");
    const events = JSON.parse(raw);

    const result = await importMatch({ matchId, events });
    return res.json({ ok: true, matchId, ...result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/", async (req, res) => {
  const session = driver.session();
  try {
    const r = await session.run(
      `MATCH (m:Match) RETURN m.matchId AS matchId, m.importedAt AS importedAt ORDER BY importedAt DESC`
    );
    res.json({
      ok: true,
      matches: r.records.map(x => ({
        matchId: x.get("matchId"),
        importedAt: x.get("importedAt") ?? null
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await session.close();
  }
});

router.get("/:matchId/teams", async (req, res) => {
  const { matchId } = req.params;
  const session = driver.session();

  try {
    const r = await session.run(
      `
      MATCH (m:Match {matchId:$matchId})-[:INVOLVES_TEAM]->(t:Team)
      RETURN t.teamId AS teamId, t.name AS name
      ORDER BY name
      `,
      { matchId }
    );

    res.json({
      ok: true,
      matchId,
      teams: r.records.map(x => ({
        teamId: x.get("teamId"),
        name: x.get("name")
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await session.close();
  }
});

router.get("/:matchId/players", async (req, res) => {
  const { matchId } = req.params;
  const teamId = req.query.teamId ? Number(req.query.teamId) : null;

  const session = driver.session();
  try {
    const r = await session.run(
      `
      MATCH (a:Player)-[p:PASSED_TO {matchId:$matchId}]->(b:Player)
      WHERE ($teamId IS NULL OR p.teamId = $teamId)
      WITH collect(DISTINCT a) + collect(DISTINCT b) AS ps
      UNWIND ps AS p
      RETURN DISTINCT p.playerId AS playerId, p.name AS name
      ORDER BY name
      `,
      { matchId, teamId }
    );

    res.json({
      ok: true,
      matchId,
      teamId,
      players: r.records.map(x => ({
        playerId: x.get("playerId"),
        name: x.get("name")
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await session.close();
  }
});


router.get("/:matchId/network", async (req, res) => {
  const { matchId } = req.params;

  const fromMin = Number.isFinite(Number(req.query.fromMin)) ? Number(req.query.fromMin) : 0;
  const toMin = Number.isFinite(Number(req.query.toMin)) ? Number(req.query.toMin) : 200;
  const teamId = req.query.teamId ? Number(req.query.teamId) : null;
  const successfulOnly = req.query.successful === "true";

  const session = driver.session();
  try {
    const cypher = `
      MATCH (a:Player)-[p:PASSED_TO {matchId:$matchId}]->(b:Player)
      WHERE p.minute >= $fromMin AND p.minute < $toMin
        AND ($teamId IS NULL OR p.teamId = $teamId)
        AND ($successfulOnly = false OR p.successful = true)
      RETURN a.playerId AS fromId, a.name AS from,
             b.playerId AS toId,   b.name AS to,
             count(p) AS count
      ORDER BY count DESC
    `;

    const r = await session.run(cypher, { matchId, fromMin, toMin, teamId, successfulOnly });

    const links = r.records.map(rec => ({
      source: rec.get("fromId"),
      target: rec.get("toId"),
      count: rec.get("count").toNumber()
    }));

    const nodesMap = new Map();
    for (const rec of r.records) {
      nodesMap.set(rec.get("fromId"), { id: rec.get("fromId"), name: rec.get("from") });
      nodesMap.set(rec.get("toId"), { id: rec.get("toId"), name: rec.get("to") });
    }

    res.json({
      ok: true,
      matchId,
      fromMin,
      toMin,
      teamId,
      nodes: [...nodesMap.values()],
      links
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await session.close();
  }
});


router.get("/:matchId/positions", async (req, res) => {
  const { matchId } = req.params;
  const fromMin = Number.isFinite(Number(req.query.fromMin)) ? Number(req.query.fromMin) : 0;
  const toMin = Number.isFinite(Number(req.query.toMin)) ? Number(req.query.toMin) : 200;
  const teamId = req.query.teamId ? Number(req.query.teamId) : null;

  const session = driver.session();
  try {
    const r = await session.run(
      `
      MATCH (a:Player)-[p:PASSED_TO {matchId:$matchId}]->()
      WHERE p.minute >= $fromMin AND p.minute < $toMin
        AND ($teamId IS NULL OR p.teamId = $teamId)
        AND p.startX IS NOT NULL AND p.startY IS NOT NULL
      RETURN a.playerId AS playerId, a.name AS name,
             avg(p.startX) AS avgX, avg(p.startY) AS avgY,
             count(p) AS passesMade
      ORDER BY passesMade DESC
      `,
      { matchId, fromMin, toMin, teamId }
    );

    const positions = r.records.map(rec => ({
      playerId: rec.get("playerId"),
      name: rec.get("name"),
      avgX: rec.get("avgX"),
      avgY: rec.get("avgY"),
      passesMade: rec.get("passesMade").toNumber()
    }));

    res.json({ ok: true, matchId, fromMin, toMin, teamId, positions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await session.close();
  }
});

router.get("/:matchId/top-passers", async (req, res) => {
  const { matchId } = req.params;

  const fromMin = Number.isFinite(Number(req.query.fromMin)) ? Number(req.query.fromMin) : 0;
  const toMin = Number.isFinite(Number(req.query.toMin)) ? Number(req.query.toMin) : 200;

  const teamId = req.query.teamId != null ? Number(req.query.teamId) : null;

  let limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  if (!Number.isInteger(limit) || limit < 0) limit = 10;

  if (teamId == null) {
    return res.status(400).json({ ok: false, error: "teamId is required" });
  }

  const session = driver.session();
  try {
    const r = await session.run(
      `
      MATCH (a:Player)-[p:PASSED_TO {matchId:$matchId}]->()
      WHERE p.minute >= $fromMin AND p.minute < $toMin
        AND p.teamId = $teamId
      RETURN a.playerId AS playerId,
            a.name AS name,
            count(p) AS attempts,
            sum(CASE WHEN p.successful = true THEN 1 ELSE 0 END) AS completed
      ORDER BY attempts DESC
      LIMIT $limit
      `,
      { matchId, fromMin, toMin, teamId, limit: neo4j.int(limit) }
    );


    res.json({
      ok: true,
      matchId,
      teamId,
      fromMin,
      toMin,
      limit,
      players: r.records.map(x => ({
        playerId: x.get("playerId"),
        name: x.get("name"),
        attempts: x.get("attempts").toNumber(),
        completed: x.get("completed").toNumber()
      }))
    });
  } catch (e) {
    console.error("PARAMS:", { matchId, fromMin, toMin, teamId, limit });
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    await session.close();
  }
});



export default router;
