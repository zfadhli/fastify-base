import fs from 'node:fs';
import path from 'node:path';
import { intro, text, select, confirm, cancel, isCancel, outro } from '@clack/prompts';
import ora from 'ora';
import pluralize from 'pluralize';
import {
  type ScaffoldConfig,
  pascalCase,
  generateSchema,
  generateSchemas,
  generateRoute,
} from '../templates';

const API_DIR = path.resolve(import.meta.dir, '..', '..', '..', '..', 'apps', 'api', 'src');
const SCHEMA_DIR = path.join(API_DIR, 'db', 'schema');
const ROUTES_DIR = path.join(API_DIR, 'routes');
const BARREL_FILE = path.join(SCHEMA_DIR, 'index.ts');

export async function scaffold(name?: string) {
  intro('Scaffold a new resource');

  const resourceName = await text({
    message: 'Resource name (singular):',
    initialValue: name,
    validate: (v?: string) => (v ? undefined : 'Resource name is required'),
  });
  if (isCancel(resourceName)) process.exit(0);

  const Name = pascalCase(resourceName);
  const plural = await text({
    message: 'Plural form:',
    initialValue: pluralize(resourceName),
  });
  if (isCancel(plural)) process.exit(0);

  const columns: { name: string; type: 'string' | 'text' | 'number' | 'boolean'; required: boolean; unique: boolean }[] = [];

  let addMore = true;
  while (addMore) {
    const colName = await text({
      message: 'Column name:',
      validate: (v?: string) => (v ? undefined : 'Column name is required'),
    });
    if (isCancel(colName)) process.exit(0);

    const colType = await select({
      message: `Type for '${colName}':`,
      options: [
        { value: 'string', label: 'string (short text)' },
        { value: 'text', label: 'text (long text)' },
        { value: 'number', label: 'number' },
        { value: 'boolean', label: 'boolean' },
      ],
    });
    if (isCancel(colType)) process.exit(0);

    const required = colType === 'string' || colType === 'number'
      ? await confirm({ message: 'Required?', initialValue: true })
      : false;
    if (isCancel(required)) process.exit(0);

    const unique = await confirm({ message: 'Unique?', initialValue: false });
    if (isCancel(unique)) process.exit(0);

    columns.push({ name: colName, type: colType as any, required, unique });

    const addMoreResult = await confirm({ message: 'Add another column?', initialValue: false });
    if (isCancel(addMoreResult)) process.exit(0);
    addMore = addMoreResult;
  }

  const ownershipResult = await confirm({ message: 'Add authorId (ownership)?', initialValue: true });
  if (isCancel(ownershipResult)) process.exit(0);
  const ownership = ownershipResult;

  const hasPublished = columns.some((c) => c.name === 'published');
  const visibility = hasPublished
    ? await confirm({ message: 'Use published field for visibility scope?' })
    : await confirm({ message: 'Add published/draft visibility?', initialValue: false });
  if (isCancel(visibility)) process.exit(0);

  const stringCols = columns.filter((c) => c.type === 'string');
  let slug: { sourceField: string } | null = null;
  if (stringCols.length > 0) {
    const wantSlug = await confirm({ message: 'Auto-generate slug from a string column?', initialValue: false });
    if (isCancel(wantSlug)) process.exit(0);
    if (wantSlug) {
      const source = stringCols.length === 1
        ? stringCols[0]!.name
        : await select({
            message: 'Source column for slug:',
            options: stringCols.map((c) => ({ value: c.name, label: c.name })),
          });
      if (isCancel(source)) process.exit(0);
      slug = { sourceField: source };
    }
  }

  const wantParent = await confirm({ message: 'Nest under a parent resource?', initialValue: false });
  if (isCancel(wantParent)) process.exit(0);

  let parent: { parentName: string; fkColumn: string } | null = null;
  if (wantParent) {
    const existing = fs.readdirSync(SCHEMA_DIR)
      .filter((f) => f.endsWith('.ts') && !f.startsWith('index') && !f.startsWith('auth'))
      .map((f) => f.replace('.ts', ''));

    if (existing.length === 0) {
      cancel('No existing schemas to use as parent. Create a parent resource first.');
      process.exit(0);
    }

    const parentName = await select({
      message: 'Parent resource:',
      options: existing.map((s) => ({ value: s, label: s })),
    });
    if (isCancel(parentName)) process.exit(0);

    const fkColumn = await text({
      message: 'FK column name:',
      initialValue: `${parentName}Id`,
    });
    if (isCancel(fkColumn)) process.exit(0);

    parent = { parentName, fkColumn };
  }

  const tableName = resourceName;
  const config: ScaffoldConfig = {
    name: resourceName,
    Name,
    plural,
    tableName,
    columns,
    ownership,
    visibility,
    slug,
    parent,
  };

  const schemaPath = path.join(SCHEMA_DIR, `${resourceName}.ts`);
  const routeDir = parent
    ? path.join(ROUTES_DIR, pluralize(parent.parentName), `[${parent.fkColumn}]`, plural)
    : path.join(ROUTES_DIR, plural);

  if (fs.existsSync(schemaPath)) {
    cancel(`Schema already exists at ${path.relative(process.cwd(), schemaPath)}`);
    process.exit(0);
  }
  if (fs.existsSync(path.join(routeDir, 'index.ts'))) {
    cancel(`Route already exists at ${path.relative(process.cwd(), path.join(routeDir, 'index.ts'))}`);
    process.exit(0);
  }

  const spinner = ora();

  spinner.start('Creating schema file...');
  fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
  fs.writeFileSync(schemaPath, generateSchema(config));
  spinner.succeed(`Created ${path.relative(process.cwd(), schemaPath)}`);

  spinner.start('Creating route schemas...');
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'schemas.ts'), generateSchemas(config));
  spinner.succeed(`Created ${path.relative(process.cwd(), path.join(routeDir, 'schemas.ts'))}`);

  spinner.start('Creating route...');
  fs.writeFileSync(path.join(routeDir, 'index.ts'), generateRoute(config));
  spinner.succeed(`Created ${path.relative(process.cwd(), path.join(routeDir, 'index.ts'))}`);

  spinner.start('Updating barrel export...');
  const exportLine = `export * from './${resourceName}';`;
  const barrelContent = fs.readFileSync(BARREL_FILE, 'utf-8');
  const lines = barrelContent.trimEnd().split('\n');
  const insertIdx = lines.findIndex((l) => l.trim().localeCompare(exportLine) > 0);
  const idx = insertIdx === -1 ? lines.length : insertIdx;
  lines.splice(idx, 0, exportLine);
  fs.writeFileSync(BARREL_FILE, lines.join('\n') + '\n');
  spinner.succeed(`Updated ${path.relative(process.cwd(), BARREL_FILE)}`);

  outro(`Resource '${Name}' scaffolded successfully!`);
}
