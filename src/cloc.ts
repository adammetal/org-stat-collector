import { exec } from "child_process";

type CLocOutput = {
  code: number;
  nFiles: number;
  langs: Array<{
    name: string;
    code: number;
    files: number;
  }>;
};

type CLocJsonReportBlock = {
  nFiles: number;
  blank: number;
  comment: number;
  code: number;
};

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const cloc = (sshUrl: string): Promise<CLocOutput> => {
  return new Promise((resolve, reject) => {
    const time = Date.now();

    exec(`./cloc.sh ${sshUrl} ${time}`, (err, stdout) => {
      if (err) {
        return reject(err);
      }

      if (!stdout.length) {
        return resolve({ code: 0, nFiles: 0, langs: [] });
      }

      let data: {
        [lang: string]: CLocJsonReportBlock;
      };

      try {
        data = JSON.parse(stdout);
      } catch {
        console.log("Json parse error", sshUrl);
        return resolve({ code: 0, nFiles: 0, langs: [] });
      }

      const { code, nFiles } = data["SUM"];
      const omit = ["SUM", "header"];
      const langs = Object.keys(data)
        .filter((key) => !omit.includes(key))
        .map((key) => ({
          name: key,
          code: data[key].code,
          files: data[key].nFiles,
        }));

      return resolve({ code, nFiles, langs });
    });
  });
};

export const clocWithAttempts = async (
  sshUrl: string,
  sleep: number,
  maxAttempt: number
): Promise<CLocOutput> => {
  let attempts = 0;

  while (true) {
    attempts += 1;

    console.log(`Attempt: ${attempts} / ${maxAttempt}`);

    try {
      return await cloc(sshUrl);
    } catch (err) {
      console.log(err);

      if (maxAttempt === attempts) {
        console.log("Fatal error, skip this repository");
        return { code: 0, nFiles: 0, langs: [] };
      }

      await delay(sleep);
    }
  }
};

export default cloc;
