/**
 * Short, sortable, collision-resistant ids: a base-36 millisecond timestamp
 * followed by 6 random characters. Sortable matters — `m` ids in creation order
 * make the event log and any hand-written SQL readable.
 */
export declare const newId: (prefix: string) => string;
/** Slugify a label into a cluster id. */
export declare const slug: (input: string) => string;
//# sourceMappingURL=ids.d.ts.map