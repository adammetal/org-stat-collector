import { readableStreamToText } from "bun";

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
    const name = `${Bun.hash(sshUrl)}${time}`;
    let output: CLocOutput;

    const proc = Bun.spawn(["./cloc.sh", sshUrl, name], {
      onExit(subprocess, exitCode, signalCode, err) {
        if (err) {
          return reject(err);
        }

        resolve(output);
      },
    });

    readableStreamToText(proc.stdout).then((stdout) => {
      if (!stdout.length) {
        output = { code: 0, nFiles: 0, langs: [] };
        return;
      }

      let data: {
        [lang: string]: CLocJsonReportBlock;
      };

      try {
        data = JSON.parse(stdout);
      } catch {
        console.log("Json parse error", sshUrl);
        output = { code: 0, nFiles: 0, langs: [] };
        return;
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

      output = { code, nFiles, langs };
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
