import fetch from "node-fetch";

const { KEY, ORG } = process.env;
const endpoint = `https://api.github.com/orgs/${ORG}/repos`;

type Cache<T> = {
  [key: string]: Promise<T> | T | null;
};

export type Repos = Array<{
  name: string;
  created_at: string;
  ssh_url: string;
}>;

const cache: Cache<Repos> = {};

const timeout = (): Promise<string> =>
  new Promise((resolve) => {
    setTimeout(() => resolve("Timeout"), 30000);
  });

export const clearCache = (key: string) => {
  if (cache[key]) {
    delete cache[key];
  }
}

export const prefetch = (page: number): void => {
  if (cache[`${page}`] && cache[`${page}`] !== null) {
    return;
  }

  const promise = fetchRepos(page);
  cache[`${page}`] = promise;

  promise
    .then((result) => {
      console.log('next page cached');
      cache[`${page}`] = result;
    })
    .catch(() => {
      cache[`${page}`] = null;
    });
};

const fetchRepos = (page: number) => {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${KEY}`,
  };

  const query = `sort=created&direction=desc&per_page=30&page=${page}`;

  return fetch(`${endpoint}?${query}`, { headers })
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res;
    })
    .then((res) => <Promise<Repos>>res.json());
};

const isRepos = (val: null | Promise<Repos> | Repos): val is Repos => {
  return !!((val as Repos).length && (val as Repos)[0].name);
};

const isPromise = (
  val: null | Promise<Repos> | Repos
): val is Promise<Repos> => {
  return !!(val as Promise<Repos>).then;
};

const queryRepos = (page: number = 1): Promise<Repos> => {
  let request;
  let cached = cache[`${page}`];

  if (!cached || cached === null) {
    request = fetchRepos(page);
  } else if (isPromise(cached)) {
    request = cached;
  } else if (isRepos(cached)) {
    console.log('cache used');
    return Promise.resolve(cached);
  } else {
    request = fetchRepos(page);
  }

  return Promise.race([request, timeout()]).then((res) => {
    if (typeof res === "string") {
      return Promise.reject("Timeout");
    }
    return res;
  });
};

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const queryReposWithRetry = async (
  sleep: number,
  maxAttempt: number,
  page: number = 1
): Promise<Repos> => {
  let attempts = 0;

  while (true) {
    attempts += 1;

    try {
      return await queryRepos(page);
    } catch (err) {
      console.log(err);
      console.log(`Attempt: ${attempts} / ${maxAttempt}`);

      if (maxAttempt === attempts) {
        throw new Error("Fatal error in query");
      }

      await delay(sleep);
    }
  }
};

export default queryRepos;
