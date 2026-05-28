let _getDb: (() => any) | undefined;

export function configure(opts: { getDb: () => any }) {
  _getDb = opts.getDb;
}

export function getDb(): any {
  return _getDb!();
}
