require("dotenv").config();

import files from "./files";
import { clocWithAttempts } from "./cloc";
import { clearCache, prefetch, queryReposWithRetry } from "./query";
import { Batch, BatchItem, Mem, Stats } from "./types";

const { LAST_DATE, SLEEP_TIME = "1000", MAX_ATTEMPT = "20" } = process.env;

if (!LAST_DATE) {
  process.exit(1);
}

const lastDate = Date.parse(LAST_DATE);

let state: { batch: Batch; mem: Mem; stats: Stats } = {
  batch: [],
  mem: {
    hasMore: true,
    page: 1,
  },
  stats: {
    loc: 0,
    files: 0,
    diskUsage: 0,
    byLangs: {},
  },
};

const createStateFilesIfNotExists = () =>
  Promise.all([
    files.createBatchIfNotExists([]),
    files.createMemIfNotExists({
      cursor: "",
      hasMore: true,
    }),
    files.createStatsIfNotExists({
      loc: 0,
      files: 0,
      diskUsage: 0,
      byLangs: {},
    }),
  ]);

const loadStartingState = async () => {
  const [batch, stats, mem] = await Promise.all([
    files.readBatch(),
    files.readStats(),
    files.readMem(),
  ]);

  state.batch = batch;
  state.stats = stats;
  state.mem = mem;
};

const saveCurrentState = () =>
  Promise.all([
    files.writeBatch(state.batch),
    files.writeMem(state.mem),
    files.writeStats(state.stats),
  ]);

const setFreshState = () => {
  state.batch = [];
  state.mem = {
    hasMore: true,
    page: 1,
  };
  state.stats = {
    loc: 0,
    files: 0,
    diskUsage: 0,
    byLangs: {},
  };

  return saveCurrentState();
};

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const die = (err: unknown, msg: string = "") => {
  console.error(err);
  console.error(msg);
  process.exit(1);
};

const queryForNextBatch = async () => {
  const page = state.mem.page;

  const result = await queryReposWithRetry(
    Number(SLEEP_TIME),
    Number(MAX_ATTEMPT),
    page
  );

  state.mem.page += 1;

  console.log("Page fetched", `Length: ${result.length}`);

  for (const repo of result) {
    const { name, created_at: createdAt, ssh_url: sshUrl } = repo;
    state.batch.push({ name, createdAt, sshUrl });
  }
};

const parseRepo = async (repo: BatchItem) => {
  const { name, createdAt, sshUrl } = repo;

  if (Date.parse(createdAt) < lastDate) {
    console.log("Arrived to final date!");
    console.log("Script done now, gratz!");
    return;
  }

  const { code, nFiles, langs } = await clocWithAttempts(
    sshUrl,
    Number(SLEEP_TIME),
    Number(MAX_ATTEMPT)
  );

  console.log(
    "Loc counted",
    `Created at: ${new Date(createdAt).toISOString()}`,
    `Last date: ${new Date(lastDate).toISOString()}`,
    `Name: ${name}`,
    `Loc: ${code}`,
    `Files: ${nFiles}`,
    `Remaining in batch: ${state.batch.length}`
  );

  for (const lang of langs) {
    if (!state.stats.byLangs[lang.name]) {
      state.stats.byLangs[lang.name] = {
        loc: lang.code,
        files: lang.files,
      };
    } else {
      state.stats.byLangs[lang.name].loc += lang.code;
      state.stats.byLangs[lang.name].files += lang.files;
    }
  }

  state.stats.loc += code;
  state.stats.files += nFiles;
};

const first = <T>(arr: T[], n: number): T[] => {
  const res: T[] = [];

  let i = 0;
  while (i < n) {
    const item = arr.shift();
    if (!item) {
      break;
    }
    res.push(item);
    i++;
  }

  return res;
};

const main = async () => {
  await files.connect();

  if (process.argv[2] === "--clean") {
    console.log("Start from clean state");
    try {
      await setFreshState();
    } catch (err) {
      die(err, "Cannot reset to a fresh state!");
    }
  }

  try {
    await createStateFilesIfNotExists();
  } catch (err) {
    die(err, "Cannot create state storage!");
  }

  try {
    await loadStartingState();
  } catch (err) {
    die(err, "Cannot load starting state!");
  }

  let { arrayBuffers, external, heapTotal, heapUsed, rss } =
    process.memoryUsage();

  while (true) {
    const current = process.memoryUsage();

    const memTable = {
      arrayBuffers: current.arrayBuffers - arrayBuffers,
      external: current.external - external,
      heapTotal: current.heapTotal - heapTotal,
      heapUsed: current.heapUsed - heapUsed,
      rss: current.rss - rss
    }

    console.table(memTable);

    arrayBuffers = current.arrayBuffers;
    external = current.external;
    heapTotal = current.heapTotal;
    heapUsed = current.heapUsed;
    rss = current.rss;

    if (!state.batch.length) {
      await queryForNextBatch();
    } else {
      // clear prev page from cache
      clearCache(`${state.mem.page - 1}`);

      prefetch(state.mem.page + 1);
      // await delay(500);
      // cloc
      const repos = first(state.batch, 5);
      const tasks = repos.map(parseRepo);

      await Promise.all(tasks);
      //const repo = state.batch.shift();
      //await parseRepo(repo!);
    }

    await saveCurrentState();
  }
};

main().finally(() => {
  console.log("Finally");
  console.log(JSON.stringify(state?.stats, null, 2));
  files.disconnect();
});
