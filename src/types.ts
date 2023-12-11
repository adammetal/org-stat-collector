export type Mem = {
  page: number;
  hasMore: boolean;
};

export type BatchItem = {
  name: string;
  createdAt: string;
  sshUrl: string;
};

export type Batch = Array<BatchItem>;

export type Stats = {
  loc: number;
  files: number;
  diskUsage: number;
  count: number;
  byLangs: {
    [lang: string]: {
      loc: number;
      files: number;
    };
  };
};
