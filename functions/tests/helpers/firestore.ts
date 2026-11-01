// Isolated provider adapter: preserve Firestore's serialization and atomic writes.
export function memoryFirestore(docs: Map<string, any>) {
  let transactions = Promise.resolve();
  function validate(value: unknown, path = "document") {
    if (value === undefined) throw Error(`Firestore cannot store undefined at ${path}`);
    if (typeof value === "number" && !Number.isFinite(value))
      throw Error(`Firestore cannot store a non-finite number at ${path}`);
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) validate(child, `${path}.${key}`);
  }
  const snapshot = (key: string, source = docs) => ({
    exists: source.has(key),
    data: () => structuredClone(source.get(key)),
  });
  const write = (target: Map<string, any>, key: string, data: any) => {
    validate(data);
    target.set(key, structuredClone(data));
  };
  const ref = (key: string) => ({
    key,
    get: async () => snapshot(key),
    set: async (data: any, options?: { merge: boolean }) =>
      write(docs, key, options?.merge ? { ...docs.get(key), ...data } : data),
  });
  return {
    collection(name: string) {
      const filters: ((data: any) => boolean)[] = [];
      let order: [string, string] | undefined, limit = Infinity;
      const query = {
        doc: (id: string) => ref(`${name}/${id}`),
        where(field: string, _operator: string, value: unknown) {
          filters.push((data) => data[field] === value);
          return query;
        },
        orderBy(field: string, direction: string) { order = [field, direction]; return query; },
        limit(count: number) { limit = count; return query; },
        async get() {
          let rows = [...docs.entries()].filter(([key, data]) =>
            key.startsWith(name + "/") && filters.every((filter) => filter(data)),
          );
          if (order) {
            const [field, direction] = order;
            rows.sort(([, a], [, b]) => String(a[field]).localeCompare(String(b[field])) * (direction === "desc" ? -1 : 1));
          }
          return { docs: rows.slice(0, limit).map(([key]) => snapshot(key)) };
        },
      };
      return query;
    },
    async runTransaction<T>(run: (tx: any) => Promise<T>): Promise<T> {
      const operation = transactions.then(async () => {
        const pending = structuredClone(docs);
        const result = await run({
          get: async (r: { key: string }) => snapshot(r.key, pending),
          set: (r: { key: string }, data: any) => write(pending, r.key, data),
          create(r: { key: string }, data: any) {
            if (pending.has(r.key)) throw Error("Document already exists");
            write(pending, r.key, data);
          },
          update: (r: { key: string }, data: any) => write(pending, r.key, { ...pending.get(r.key), ...data }),
          delete: (r: { key: string }) => pending.delete(r.key),
        });
        docs.clear();
        for (const [key, data] of pending) docs.set(key, data);
        return result;
      });
      transactions = operation.then(() => {}, () => {});
      return operation;
    },
  };
}
