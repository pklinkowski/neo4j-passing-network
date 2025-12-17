import { driver } from "./neo4j.js";

export async function importMatch({ matchId, events }) {
  if (!Array.isArray(events)) throw new Error("Uploaded JSON must be an array of events.");

  const teamsMap = new Map();
  const passes = [];

  for (const e of events) {
    const team = e?.team;
    if (team?.id && team?.name) teamsMap.set(team.id, team.name);

    if (e?.type?.name !== "Pass") continue;

    const pass = e.pass;
    const from = e.player;
    const to = pass?.recipient;

    if (!from?.id || !to?.id) continue;

    const [startX, startY] = e.location ?? [null, null];
    const [endX, endY] = pass.end_location ?? [null, null];

    const successful = (pass.outcome == null);

    passes.push({
      eventId: e.id,
      matchId,
      teamId: team?.id ?? null,
      fromId: from.id,
      fromName: from.name ?? "",
      toId: to.id,
      toName: to.name ?? "",
      minute: e.minute ?? null,
      second: e.second ?? null,
      timestamp: e.timestamp ?? null,
      startX, startY, endX, endY,
      length: pass.length ?? null,
      underPressure: !!e.under_pressure,
      successful
    });
  }

  const teams = [...teamsMap.entries()].map(([id, name]) => ({ id, name }));

  const session = driver.session();
  try {
    await session.run(
      `MATCH (:Player)-[p:PASSED_TO {matchId:$matchId}]->(:Player) DELETE p`,
      { matchId }
    );

    await session.run(
      `MATCH (m:Match {matchId:$matchId}) DETACH DELETE m`,
      { matchId }
    );

    await session.executeWrite(tx => tx.run(
      `
      MERGE (m:Match {matchId:$matchId})
      SET m.importedAt = datetime()

      WITH m
      UNWIND $teams AS t
      MERGE (team:Team {teamId: t.id})
      ON CREATE SET team.name = t.name

      WITH m
      UNWIND $teams AS t
      MATCH (team:Team {teamId: t.id})
      MERGE (m)-[:INVOLVES_TEAM]->(team)
      `,
      { matchId, teams }
    ));

    await session.executeWrite(tx => tx.run(
      `
      UNWIND $passes AS p
      MERGE (a:Player {playerId: p.fromId})
        ON CREATE SET a.name = p.fromName
      MERGE (b:Player {playerId: p.toId})
        ON CREATE SET b.name = p.toName

      WITH a, b, p
      FOREACH (_ IN CASE WHEN p.teamId IS NULL THEN [] ELSE [1] END |
        MERGE (t:Team {teamId: p.teamId})
        MERGE (t)-[:HAS_PLAYER]->(a)
        MERGE (t)-[:HAS_PLAYER]->(b)
      )

      CREATE (a)-[r:PASSED_TO]->(b)
      SET r.eventId = p.eventId,
          r.matchId = p.matchId,
          r.teamId = p.teamId,
          r.minute = p.minute,
          r.second = p.second,
          r.timestamp = p.timestamp,
          r.startX = p.startX, r.startY = p.startY,
          r.endX = p.endX, r.endY = p.endY,
          r.length = p.length,
          r.underPressure = p.underPressure,
          r.successful = p.successful
      `,
      { passes }
    ));

    return { teamsImported: teams.length, passesImported: passes.length };
  } finally {
    await session.close();
  }
}
