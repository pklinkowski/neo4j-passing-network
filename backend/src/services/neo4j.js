import neo4j from "neo4j-driver";
import { config } from "../config/env.js";

export const driver = neo4j.driver(
  config.neo4j.uri,
  neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
);

export async function testNeo4jConnection() {
  const session = driver.session();
  try {
    const res = await session.run("RETURN 1 AS ok");
    return res.records[0].get("ok");
  } finally {
    await session.close();
  }
}
