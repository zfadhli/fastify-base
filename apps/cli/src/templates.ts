import Handlebars from 'handlebars';
import fs from 'node:fs';
import path from 'node:path';

export interface Column {
  name: string;
  type: 'string' | 'text' | 'number' | 'boolean';
  required: boolean;
  unique: boolean;
}

export interface ParentConfig {
  parentName: string;
  fkColumn: string;
}

export interface SlugConfig {
  sourceField: string;
}

export interface ScaffoldConfig {
  name: string;
  Name: string;
  plural: string;
  tableName: string;
  columns: Column[];
  ownership: boolean;
  visibility: boolean;
  slug: SlugConfig | null;
  parent: ParentConfig | null;
}

const TEMPLATES_DIR = path.resolve(import.meta.dir, '..', 'templates');

function loadTemplate(name: string) {
  return Handlebars.compile(fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8'));
}

const schemaTemplate = loadTemplate('schema.hbs');
const schemasTemplate = loadTemplate('schemas.hbs');
const routeTemplate = loadTemplate('route.hbs');

export function pascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

function columnToDrizzle(col: Column): string {
  let base: string;
  switch (col.type) {
    case 'string':
      base = `text('${col.name}')`;
      break;
    case 'text':
      base = `text('${col.name}')`;
      break;
    case 'number':
      base = `integer('${col.name}')`;
      break;
    case 'boolean':
      base = `integer('${col.name}', { mode: 'boolean' })`;
      break;
  }
  if (col.required) base += '.notNull()';
  if (col.unique) base += '.unique()';
  return `  ${col.name}: ${base}`;
}

function columnToTypeBoxBody(col: Column, visibility: boolean): string {
  const name = col.name;
  if (name === 'published' && visibility) {
    return `  ${name}: Type.Optional(Type.Boolean()),`;
  }
  if (col.required) {
    switch (col.type) {
      case 'string':
        return `  ${name}: Type.String({ minLength: 1 }),`;
      case 'text':
        return `  ${name}: Type.String({ minLength: 1 }),`;
      case 'number':
        return `  ${name}: Type.Number(),`;
      case 'boolean':
        return `  ${name}: Type.Boolean(),`;
    }
  }
  switch (col.type) {
    case 'string':
      return `  ${name}: Type.Optional(Type.String()),`;
    case 'text':
      return `  ${name}: Type.Optional(Type.String()),`;
    case 'number':
      return `  ${name}: Type.Optional(Type.Number()),`;
    case 'boolean':
      return `  ${name}: Type.Optional(Type.Boolean()),`;
  }
}

function columnToTypeBoxResponse(col: Column, visibility: boolean): string {
  if (col.name === 'published' && visibility) {
    return `  ${col.name}: Type.Boolean(),`;
  }
  if (!col.required) {
    switch (col.type) {
      case 'string':
        return `  ${col.name}: Type.Union([Type.String(), Type.Null()]),`;
      case 'text':
        return `  ${col.name}: Type.Union([Type.String(), Type.Null()]),`;
      case 'number':
        return `  ${col.name}: Type.Union([Type.Number(), Type.Null()]),`;
      case 'boolean':
        return `  ${col.name}: Type.Boolean(),`;
    }
  }
  switch (col.type) {
    case 'string':
      return `  ${col.name}: Type.String(),`;
    case 'text':
      return `  ${col.name}: Type.String(),`;
    case 'number':
      return `  ${col.name}: Type.Number(),`;
    case 'boolean':
      return `  ${col.name}: Type.Boolean(),`;
  }
}

export function generateSchema(config: ScaffoldConfig): string {
  const { name, tableName, columns, ownership, parent, visibility, slug } = config;

  const drizzleTypes = ['sqliteTable', 'text'];
  const hasNumber = columns.some((c) => c.type === 'number');
  const hasBoolean = columns.some((c) => c.type === 'boolean') || visibility;
  if (hasNumber || hasBoolean) drizzleTypes.push('integer');

  const autoCols = new Set<string>();
  if (visibility) autoCols.add('published');
  if (slug) autoCols.add('slug');
  if (ownership) autoCols.add('authorId');
  if (parent) autoCols.add(parent.fkColumn);

  const colDefs: string[] = [];
  for (const col of columns) {
    if (autoCols.has(col.name)) continue;
    colDefs.push(columnToDrizzle(col) + ',');
  }

  return schemaTemplate({
    drizzleImports: drizzleTypes.join(', '),
    hasParentImport: !!parent,
    parentImportName: parent?.parentName,
    hasUserImport: ownership,
    tableVar: name,
    tableName,
    hasParentFk: !!parent,
    parentFkCol: parent?.fkColumn,
    parentFkVar: parent?.parentName,
    columns: colDefs,
    hasVisibility: visibility,
    hasSlug: !!slug,
    hasOwnership: ownership,
  });
}

export function generateSchemas(config: ScaffoldConfig): string {
  const { Name, columns, ownership, parent, visibility, slug } = config;

  const listParamsName = parent ? `${pascalCase(parent.fkColumn)}Params` : undefined;

  const bodyCols: string[] = [];
  for (const col of columns) {
    if (['id', 'createdAt', 'updatedAt', 'slug'].includes(col.name)) continue;
    bodyCols.push(columnToTypeBoxBody(col, visibility));
  }

  const responseCols: string[] = [];
  if (parent) responseCols.push(`  ${parent.fkColumn}: Type.String(),`);
  for (const col of columns) {
    responseCols.push(columnToTypeBoxResponse(col, visibility));
  }
  if (slug) responseCols.push(`  slug: Type.String(),`);
  if (ownership) responseCols.push(`  authorId: Type.String(),`);

  const listCols: string[] = [];
  for (const col of columns) {
    if (col.type === 'text') continue;
    if (['updatedAt', 'slug'].includes(col.name)) continue;
    listCols.push(columnToTypeBoxResponse(col, visibility));
  }
  if (ownership) listCols.push(`  authorId: Type.String(),`);

  return schemasTemplate({
    Name,
    hasParent: !!parent,
    parentFkCol: parent?.fkColumn,
    listParamsName,
    paramsName: `${Name}Params`,
    bodyCols,
    responseCols,
    listCols,
  });
}

export function generateRoute(config: ScaffoldConfig): string {
  const { name, Name, columns, plural, ownership, parent, visibility, slug } = config;

  const schemaImports: string[] = [name];
  if (ownership) schemaImports.push('user');
  if (parent && !schemaImports.includes(parent.parentName)) schemaImports.push(parent.parentName);

  const schemaNames: string[] = [];
  const listParamsName = parent ? `${pascalCase(parent.fkColumn)}Params` : undefined;
  if (listParamsName) schemaNames.push(listParamsName);
  schemaNames.push(`${Name}Params`);
  schemaNames.push(`Create${Name}Body`);
  schemaNames.push(`Update${Name}Body`);
  schemaNames.push(`${Name}Response`);
  schemaNames.push(`${Name}ListItem`);

  const filterDefs: string[] = [];
  const filterCols = columns.filter((c) => ['string', 'number', 'boolean'].includes(c.type) && !['slug', 'id'].includes(c.name));
  for (const col of filterCols) {
    if (col.name === 'published' && visibility) continue;
    filterDefs.push(`    { field: '${col.name}', type: '${col.type}' },`);
  }
  if (visibility) filterDefs.push(`    { field: 'published', type: 'boolean' },`);
  if (parent) filterDefs.push(`    { field: '${parent.fkColumn}', type: 'string' },`);
  if (ownership) filterDefs.push(`    { field: 'authorId', type: 'string' },`);

  const sortCols = ['createdAt', ...columns.filter((c) => ['string', 'number'].includes(c.type) && !['slug', 'id', 'createdAt', 'updatedAt'].includes(c.name)).map((c) => c.name)];
  if (visibility) sortCols.push('published');
  const sortDefs = sortCols.map((c) => `'${c}'`).join(', ');

  return routeTemplate({
    schemaImportsJoined: schemaImports.join(', '),
    schemaNamesJoined: schemaNames.join(', '),
    name,
    Name,
    hasIdParam: !!parent,
    idParam: parent ? `${name.toLowerCase()}Id` : undefined,
    hasListParams: !!listParamsName,
    listParamsName,
    paramsName: `${Name}Params`,
    createBodyName: `Create${Name}Body`,
    updateBodyName: `Update${Name}Body`,
    responseName: `${Name}Response`,
    listItemName: `${Name}ListItem`,
    hasOwnership: ownership,
    hasVisibility: visibility,
    hasParent: !!parent,
    parentFkCol: parent?.fkColumn,
    parentVar: parent?.parentName,
    parentName: parent ? pascalCase(parent.parentName) : undefined,
    hasFilters: filterDefs.length > 0,
    filterDefs,
    sortDefs,
    hasSlug: !!slug,
    slugSource: slug?.sourceField,
  });
}
