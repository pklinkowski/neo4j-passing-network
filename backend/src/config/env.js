import dotenv from "dotenv";

dotenv.config();

export const config = {
  neo4j: {
    uri: process.env.NEO4J_URI,
    user: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD,
  },
  port: process.env.PORT || 3001
};
