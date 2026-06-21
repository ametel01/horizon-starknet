import { spawnSync } from 'node:child_process';

type KnipSymbol = {
  name: string;
  line: number;
  col: number;
};

type KnipIssue = {
  file: string;
  exports?: KnipSymbol[];
  types?: KnipSymbol[];
  nsExports?: KnipSymbol[];
  nsTypes?: KnipSymbol[];
  enumMembers?: KnipSymbol[];
  namespaceMembers?: KnipSymbol[];
  duplicates?: KnipSymbol[];
};

type KnipReport = {
  issues?: KnipIssue[];
};

const GENERATED_PREFIX = 'src/types/generated/';
const MDX_DOCS_PREFIX = 'src/features/docs/ui/';
const ISSUE_GROUPS = [
  ['exports', 'Unused exports'],
  ['types', 'Unused exported types'],
  ['nsExports', 'Unused namespace exports'],
  ['nsTypes', 'Unused namespace types'],
  ['enumMembers', 'Unused enum members'],
  ['namespaceMembers', 'Unused namespace members'],
  ['duplicates', 'Duplicate exports'],
] as const;

const result = spawnSync(
  'bunx',
  ['--bun', 'knip', '--exports', '--reporter', 'json', '--no-progress', '--no-exit-code'],
  {
    cwd: import.meta.dir + '/..',
    encoding: 'utf8',
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.stderr.trim()) {
  console.error(result.stderr.trim());
}

const report = JSON.parse(result.stdout) as KnipReport;
const issues = (report.issues ?? []).filter(
  (issue) => !issue.file.startsWith(GENERATED_PREFIX) && !issue.file.startsWith(MDX_DOCS_PREFIX)
);

let issueCount = 0;

for (const [key, title] of ISSUE_GROUPS) {
  const rows = issues
    .map((issue) => ({
      file: issue.file,
      symbols: issue[key] ?? [],
    }))
    .filter((issue) => issue.symbols.length > 0);

  if (rows.length === 0) continue;

  console.log(`${title} (${rows.reduce((total, row) => total + row.symbols.length, 0)})`);

  for (const row of rows) {
    issueCount += row.symbols.length;
    console.log(`${row.file}: ${row.symbols.map((symbol) => symbol.name).join(', ')}`);
  }
}

if (issueCount > 0) {
  process.exit(1);
}

console.log('No unused exports found.');
