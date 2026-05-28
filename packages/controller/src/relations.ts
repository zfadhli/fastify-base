import { createTableRelationsHelpers, eq } from 'drizzle-orm';
import { Many, One } from 'drizzle-orm/relations';
import type { Relations } from 'drizzle-orm';
import type { JoinConfig } from './query';
import type { IncludeConfig } from './types';

function findInverseOne(rel: any, relationsList: Relations[]) {
  for (const r of relationsList) {
    if (r.table === rel.referencedTable) {
      const helpers = createTableRelationsHelpers(rel.referencedTable);
      for (const [, ref] of Object.entries(r.config(helpers))) {
        if (ref instanceof One && (ref as any).referencedTable === rel.sourceTable && (ref as any).config) {
          return ref as One;
        }
      }
    }
  }
  return null;
}

export function processRelations(
  model: any,
  relationsList: Relations[],
  schemas?: Record<string, any>,
): { joins: JoinConfig[]; includeMap: Record<string, IncludeConfig> } {
  const modelRel = relationsList.find((r) => r.table === model);
  if (!modelRel) return { joins: [], includeMap: {} };

  const helpers = createTableRelationsHelpers(model);
  const instances: Record<string, any> = modelRel.config(helpers);

  const joins: JoinConfig[] = [];
  const includeMap: Record<string, IncludeConfig> = {};

  for (const [alias, rel] of Object.entries(instances)) {
    if (rel instanceof One && rel.config) {
      const fk = rel.config.fields[0];
      const pk = rel.config.references[0];
      if (!fk || !pk) continue;

      joins.push({ table: rel.referencedTable, alias, on: eq(fk, pk) });

      includeMap[alias] = {
        type: 'single',
        table: rel.referencedTable,
        schema: schemas?.[alias] ?? null,
        localKey: fk.name,
        foreignKey: pk.name,
      };
    } else if (rel instanceof Many) {
      const inverse = findInverseOne(rel, relationsList);
      if (inverse?.config) {
        const invFk = inverse.config.fields[0];
        const invPk = inverse.config.references[0];
        if (!invFk || !invPk) continue;

        includeMap[alias] = {
          type: 'many',
          table: rel.referencedTable,
          schema: schemas?.[alias] ?? null,
          localKey: invPk.name,
          foreignKey: invFk.name,
        };
      }
    }
  }

  return { joins, includeMap };
}
