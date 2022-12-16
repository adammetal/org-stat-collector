import { createClient } from "redis";
import type { Batch, Mem, Stats } from "./types";

const client = createClient();

const connect = () => client.connect();
const disconnect = () => client.disconnect();

const readJson = (file: string) =>
  client.get(file).then((val) => {
    if (val !== null) {
      return JSON.parse(val);
    }
    return null;
  });

const writeJson = (file: string, json: unknown) =>
  client.set(file, JSON.stringify(json));

const createJsonFileIfNotExists = (file: string) => async (json: unknown) => {
  if (!(await client.exists(file))) {
    await writeJson(file, json);
  }
};

const batchPath = "batch";
const memPath = "mem";
const statsPath = "stats";

const readBatch = (): Promise<Batch> => readJson(batchPath);
const writeBatch = (batch: Batch) => writeJson(batchPath, batch);

const readMem = (): Promise<Mem> => readJson(memPath);
const writeMem = (mem: Mem) => writeJson(memPath, mem);

const readStats = (): Promise<Stats> => readJson(statsPath);
const writeStats = (stats: Stats) => writeJson(statsPath, stats);

const createBatchIfNotExists = createJsonFileIfNotExists(batchPath);
const createMemIfNotExists = createJsonFileIfNotExists(memPath);
const createStatsIfNotExists = createJsonFileIfNotExists(statsPath);

export default {
  connect,
  disconnect,
  readBatch,
  writeBatch,
  readMem,
  writeMem,
  readStats,
  writeStats,
  createMemIfNotExists,
  createBatchIfNotExists,
  createStatsIfNotExists,
};
