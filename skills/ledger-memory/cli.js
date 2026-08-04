#!/usr/bin/env bun
// @bun

// packages/cli/src/index.ts
import { parseArgs } from "util";
// packages/core/src/errors.ts
var explain = (f) => {
  switch (f.kind) {
    case "unknown-cluster":
      return `No cluster "${f.cluster}". Known clusters: ${f.known.join(", ")}. Create it with clusters.create, or write to an existing one.`;
    case "unknown-memory":
      return `No memory ${f.id}. It may have been dropped.`;
    case "unknown-source":
      return `No source ${f.id}.`;
    case "unknown-conflict":
      return `No open conflict ${f.id}. It may already be resolved.`;
    case "unknown-candidate":
      return `No pending conflict candidate ${f.id}. It may already have been judged.`;
    case "invalid-query":
      return `Cannot parse "${f.token}": ${f.reason}`;
    case "invalid-input":
      return `Invalid input: ${f.issues.join("; ")}`;
    case "not-a-claim":
      return `${f.id} is a document chunk. Chunks are trusted or dropped with their source, never reviewed one by one.`;
    case "unreadable-source":
      return `Cannot read ${f.path}: ${f.reason}. Extract the text yourself and pass it as \`text\`.`;
  }
};
// node_modules/.bun/neverthrow@8.2.0/node_modules/neverthrow/dist/index.es.js
var defaultErrorConfig = {
  withStackTrace: false
};
var createNeverThrowError = (message, result, config = defaultErrorConfig) => {
  const data = result.isOk() ? { type: "Ok", value: result.value } : { type: "Err", value: result.error };
  const maybeStack = config.withStackTrace ? new Error().stack : undefined;
  return {
    data,
    message,
    stack: maybeStack
  };
};
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m)
    return m.call(o);
  if (o && typeof o.length === "number")
    return {
      next: function() {
        if (o && i >= o.length)
          o = undefined;
        return { value: o && o[i++], done: !o };
      }
    };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator)
    throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f)
        i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length)
      resume(q[0][0], q[0][1]);
  }
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator)
    throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
class ResultAsync {
  constructor(res) {
    this._promise = res;
  }
  static fromSafePromise(promise) {
    const newPromise = promise.then((value) => new Ok(value));
    return new ResultAsync(newPromise);
  }
  static fromPromise(promise, errorFn) {
    const newPromise = promise.then((value) => new Ok(value)).catch((e) => new Err(errorFn(e)));
    return new ResultAsync(newPromise);
  }
  static fromThrowable(fn, errorFn) {
    return (...args) => {
      return new ResultAsync((() => __awaiter(this, undefined, undefined, function* () {
        try {
          return new Ok(yield fn(...args));
        } catch (error) {
          return new Err(errorFn ? errorFn(error) : error);
        }
      }))());
    };
  }
  static combine(asyncResultList) {
    return combineResultAsyncList(asyncResultList);
  }
  static combineWithAllErrors(asyncResultList) {
    return combineResultAsyncListWithAllErrors(asyncResultList);
  }
  map(f) {
    return new ResultAsync(this._promise.then((res) => __awaiter(this, undefined, undefined, function* () {
      if (res.isErr()) {
        return new Err(res.error);
      }
      return new Ok(yield f(res.value));
    })));
  }
  andThrough(f) {
    return new ResultAsync(this._promise.then((res) => __awaiter(this, undefined, undefined, function* () {
      if (res.isErr()) {
        return new Err(res.error);
      }
      const newRes = yield f(res.value);
      if (newRes.isErr()) {
        return new Err(newRes.error);
      }
      return new Ok(res.value);
    })));
  }
  andTee(f) {
    return new ResultAsync(this._promise.then((res) => __awaiter(this, undefined, undefined, function* () {
      if (res.isErr()) {
        return new Err(res.error);
      }
      try {
        yield f(res.value);
      } catch (e) {}
      return new Ok(res.value);
    })));
  }
  orTee(f) {
    return new ResultAsync(this._promise.then((res) => __awaiter(this, undefined, undefined, function* () {
      if (res.isOk()) {
        return new Ok(res.value);
      }
      try {
        yield f(res.error);
      } catch (e) {}
      return new Err(res.error);
    })));
  }
  mapErr(f) {
    return new ResultAsync(this._promise.then((res) => __awaiter(this, undefined, undefined, function* () {
      if (res.isOk()) {
        return new Ok(res.value);
      }
      return new Err(yield f(res.error));
    })));
  }
  andThen(f) {
    return new ResultAsync(this._promise.then((res) => {
      if (res.isErr()) {
        return new Err(res.error);
      }
      const newValue = f(res.value);
      return newValue instanceof ResultAsync ? newValue._promise : newValue;
    }));
  }
  orElse(f) {
    return new ResultAsync(this._promise.then((res) => __awaiter(this, undefined, undefined, function* () {
      if (res.isErr()) {
        return f(res.error);
      }
      return new Ok(res.value);
    })));
  }
  match(ok, _err) {
    return this._promise.then((res) => res.match(ok, _err));
  }
  unwrapOr(t) {
    return this._promise.then((res) => res.unwrapOr(t));
  }
  safeUnwrap() {
    return __asyncGenerator(this, arguments, function* safeUnwrap_1() {
      return yield __await(yield __await(yield* __asyncDelegator(__asyncValues(yield __await(this._promise.then((res) => res.safeUnwrap()))))));
    });
  }
  then(successCallback, failureCallback) {
    return this._promise.then(successCallback, failureCallback);
  }
  [Symbol.asyncIterator]() {
    return __asyncGenerator(this, arguments, function* _a() {
      const result = yield __await(this._promise);
      if (result.isErr()) {
        yield yield __await(errAsync(result.error));
      }
      return yield __await(result.value);
    });
  }
}
function errAsync(err) {
  return new ResultAsync(Promise.resolve(new Err(err)));
}
var fromPromise = ResultAsync.fromPromise;
var fromSafePromise = ResultAsync.fromSafePromise;
var fromAsyncThrowable = ResultAsync.fromThrowable;
var combineResultList = (resultList) => {
  let acc = ok([]);
  for (const result of resultList) {
    if (result.isErr()) {
      acc = err(result.error);
      break;
    } else {
      acc.map((list) => list.push(result.value));
    }
  }
  return acc;
};
var combineResultAsyncList = (asyncResultList) => ResultAsync.fromSafePromise(Promise.all(asyncResultList)).andThen(combineResultList);
var combineResultListWithAllErrors = (resultList) => {
  let acc = ok([]);
  for (const result of resultList) {
    if (result.isErr() && acc.isErr()) {
      acc.error.push(result.error);
    } else if (result.isErr() && acc.isOk()) {
      acc = err([result.error]);
    } else if (result.isOk() && acc.isOk()) {
      acc.value.push(result.value);
    }
  }
  return acc;
};
var combineResultAsyncListWithAllErrors = (asyncResultList) => ResultAsync.fromSafePromise(Promise.all(asyncResultList)).andThen(combineResultListWithAllErrors);
var Result;
(function(Result2) {
  function fromThrowable(fn, errorFn) {
    return (...args) => {
      try {
        const result = fn(...args);
        return ok(result);
      } catch (e) {
        return err(errorFn ? errorFn(e) : e);
      }
    };
  }
  Result2.fromThrowable = fromThrowable;
  function combine(resultList) {
    return combineResultList(resultList);
  }
  Result2.combine = combine;
  function combineWithAllErrors(resultList) {
    return combineResultListWithAllErrors(resultList);
  }
  Result2.combineWithAllErrors = combineWithAllErrors;
})(Result || (Result = {}));
function ok(value) {
  return new Ok(value);
}
function err(err2) {
  return new Err(err2);
}
class Ok {
  constructor(value) {
    this.value = value;
  }
  isOk() {
    return true;
  }
  isErr() {
    return !this.isOk();
  }
  map(f) {
    return ok(f(this.value));
  }
  mapErr(_f) {
    return ok(this.value);
  }
  andThen(f) {
    return f(this.value);
  }
  andThrough(f) {
    return f(this.value).map((_value) => this.value);
  }
  andTee(f) {
    try {
      f(this.value);
    } catch (e) {}
    return ok(this.value);
  }
  orTee(_f) {
    return ok(this.value);
  }
  orElse(_f) {
    return ok(this.value);
  }
  asyncAndThen(f) {
    return f(this.value);
  }
  asyncAndThrough(f) {
    return f(this.value).map(() => this.value);
  }
  asyncMap(f) {
    return ResultAsync.fromSafePromise(f(this.value));
  }
  unwrapOr(_v) {
    return this.value;
  }
  match(ok2, _err) {
    return ok2(this.value);
  }
  safeUnwrap() {
    const value = this.value;
    return function* () {
      return value;
    }();
  }
  _unsafeUnwrap(_) {
    return this.value;
  }
  _unsafeUnwrapErr(config) {
    throw createNeverThrowError("Called `_unsafeUnwrapErr` on an Ok", this, config);
  }
  *[Symbol.iterator]() {
    return this.value;
  }
}

class Err {
  constructor(error) {
    this.error = error;
  }
  isOk() {
    return false;
  }
  isErr() {
    return !this.isOk();
  }
  map(_f) {
    return err(this.error);
  }
  mapErr(f) {
    return err(f(this.error));
  }
  andThrough(_f) {
    return err(this.error);
  }
  andTee(_f) {
    return err(this.error);
  }
  orTee(f) {
    try {
      f(this.error);
    } catch (e) {}
    return err(this.error);
  }
  andThen(_f) {
    return err(this.error);
  }
  orElse(f) {
    return f(this.error);
  }
  asyncAndThen(_f) {
    return errAsync(this.error);
  }
  asyncAndThrough(_f) {
    return errAsync(this.error);
  }
  asyncMap(_f) {
    return errAsync(this.error);
  }
  unwrapOr(v) {
    return v;
  }
  match(_ok, err2) {
    return err2(this.error);
  }
  safeUnwrap() {
    const error = this.error;
    return function* () {
      yield err(error);
      throw new Error("Do not use this generator out of `safeTry`");
    }();
  }
  _unsafeUnwrap(config) {
    throw createNeverThrowError("Called `_unsafeUnwrap` on an Err", this, config);
  }
  _unsafeUnwrapErr(_) {
    return this.error;
  }
  *[Symbol.iterator]() {
    const self = this;
    yield self;
    return self;
  }
}
var fromThrowable = Result.fromThrowable;

// packages/core/src/ingest.ts
var NATIVE_EXTENSIONS = [
  "md",
  "markdown",
  "txt",
  "text",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "log",
  "yaml",
  "yml"
];
var isNative = (filename) => NATIVE_EXTENSIONS.includes(extensionOf(filename));
var extensionOf = (filename) => filename.includes(".") ? (filename.split(".").pop() ?? "").toLowerCase() : "";
var readSourceFile = async (path) => {
  const filename = path.split("/").pop() ?? path;
  const ext = extensionOf(filename);
  if (!isNative(filename)) {
    return err({
      kind: "unreadable-source",
      path,
      reason: `.${ext || "unknown"} needs a parser this server does not bundle`
    });
  }
  const file = Bun.file(path);
  if (!await file.exists()) {
    return err({ kind: "unreadable-source", path, reason: "no such file" });
  }
  const text = await file.text();
  if (!text.trim()) {
    return err({ kind: "unreadable-source", path, reason: "file is empty" });
  }
  return ok({ filename, ext, text, bytes: file.size });
};
var DEFAULT_CHUNKING = { target: 900, max: 1600 };
var splitLongBlock = (block, max) => {
  const sentences = block.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [block];
  const out = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > max) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim())
    out.push(current.trim());
  return out;
};
var chunkText = (text, options = DEFAULT_CHUNKING) => {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  const flush = () => {
    if (current.trim())
      chunks.push(current.trim());
    current = "";
  };
  for (const block of blocks) {
    const isHeading = /^#{1,6}\s/.test(block);
    if (isHeading && current)
      flush();
    if (block.length > options.max) {
      flush();
      chunks.push(...splitLongBlock(block, options.max));
      continue;
    }
    if (current && current.length + block.length + 2 > options.target)
      flush();
    current = current ? `${current}

${block}` : block;
  }
  flush();
  return chunks.length > 0 ? chunks : [text.trim()];
};
// packages/core/src/store.ts
import { Database } from "bun:sqlite";

// packages/tokens/src/index.ts
var color = {
  bg: "#0a0b0c",
  bgSunken: "#08090a",
  surface: "#0d0f11",
  surfaceAlt: "#0c0e10",
  surfaceHover: "#141719",
  surfaceInset: "#0e1012",
  border: "#202427",
  borderStrong: "#2b3036",
  borderSubtle: "#141719",
  text: "#e7e9eb",
  textMuted: "#a9b0b7",
  textDim: "#868d95",
  textFaint: "#575e66",
  textGhost: "#4e555c",
  textTrace: "#3f464c",
  accent: "#c0f24a",
  accentBright: "#d8ff7d",
  accentSurface: "#151a10",
  accentBorder: "#2f3a1a",
  accentDim: "#4d5f24",
  danger: "#e0555f",
  dangerBorder: "#4a2429",
  dangerSurface: "#1c1012",
  warn: "#f2913f",
  warnSurface: "#14100c",
  warnBorder: "#2a2119"
};
var clusterColor = {
  prefs: "#b7c14a",
  people: "#4a9fd4",
  code: "#cf6fb8",
  travel: "#4fb8a8",
  health: "#6fbf73",
  money: "#d9a03c",
  home: "#6f86e0",
  reading: "#9a76dd",
  proc: "#e0793f",
  projects: "#d6606a"
};
var clusterPalette = Object.values(clusterColor);
var strengthScale = [
  { min: 0.7, color: color.accent, label: "strong" },
  { min: 0.4, color: "#d9a03c", label: "holding" },
  { min: 0, color: color.danger, label: "decaying" }
];

// packages/core/src/conflicts.ts
var STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "me",
  "my",
  "of",
  "on",
  "or",
  "she",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "was",
  "were",
  "when",
  "which",
  "with",
  "you",
  "your"
]);
var NEGATION = /\b(never|not|no longer|isn't|doesn't|don't|cannot|can't|won't|avoid[s]?|avoided|stopped|dropped|without|instead of|rather than|switched)\b/i;
var WEEKDAYS = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|days)?\b/gi;
var MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi;
var ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
var CLOCK = /\b\d{1,2}:\d{2}\b/g;
var NUMBER = /\b\d+(?:[.,]\d+)?\b/g;
var tokenise = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
var contentTokens = (text) => new Set(tokenise(text));
var headTokens = (text, count = 3) => new Set(tokenise(text).slice(0, count));
var jaccard = (a, b) => {
  if (a.size === 0 || b.size === 0)
    return 0;
  let shared = 0;
  for (const t of a)
    if (b.has(t))
      shared += 1;
  return shared / (a.size + b.size - shared);
};
var matchSet = (text, pattern) => new Set((text.match(pattern) ?? []).map((m) => m.toLowerCase()));
var differs = (a, b) => {
  if (a.size === 0 || b.size === 0)
    return false;
  if (a.size !== b.size)
    return true;
  for (const v of a)
    if (!b.has(v))
      return true;
  return false;
};
var OVERLAP_FLOOR = 0.18;
var suspect = (textA, textB) => {
  const bodyOverlap = jaccard(contentTokens(textA), contentTokens(textB));
  const headOverlap = jaccard(headTokens(textA), headTokens(textB));
  const overlap = Math.max(bodyOverlap, headOverlap);
  if (overlap < OVERLAP_FLOOR)
    return null;
  const signals = [];
  if (differs(matchSet(textA, NUMBER), matchSet(textB, NUMBER)))
    signals.push("divergent numbers");
  if (differs(matchSet(textA, ISO_DATE), matchSet(textB, ISO_DATE)))
    signals.push("divergent dates");
  if (differs(matchSet(textA, CLOCK), matchSet(textB, CLOCK)))
    signals.push("divergent times");
  if (differs(matchSet(textA, WEEKDAYS), matchSet(textB, WEEKDAYS)))
    signals.push("divergent weekdays");
  if (differs(matchSet(textA, MONTHS), matchSet(textB, MONTHS)))
    signals.push("divergent months");
  if (NEGATION.test(textA) !== NEGATION.test(textB))
    signals.push("negation on one side");
  if (signals.length === 0)
    return null;
  const divergence = Math.min(1, signals.length / 3);
  return {
    score: Number((overlap * 0.6 + divergence * 0.4).toFixed(4)),
    signals
  };
};
var pairKey = (a, b) => a < b ? [a, b] : [b, a];

// packages/core/src/ids.ts
var ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
var newId = (prefix) => {
  const time = Date.now().toString(36);
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let random = "";
  for (const b of bytes)
    random += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${time}${random}`;
};
var slug = (input) => input.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// packages/core/src/query.ts
var DAY = 86400000;
var FILTER_KEYS = [
  ["agent", "written or read by an agent"],
  ["cluster", "topic cluster"],
  ["type", "chat or doc"],
  ["kind", "claim or chunk"],
  ["strength", "how much the store trusts it, e.g. strength:<40"],
  ["asof", "knowledge as it stood on a date"],
  ["after", "created after a date"],
  ["before", "created before a date"]
];
var KEY_SET = new Set(FILTER_KEYS.map(([k]) => k));
var EMPTY = {
  terms: [],
  agent: [],
  cluster: [],
  type: [],
  kind: [],
  strength: null,
  asOf: null,
  before: null,
  after: null
};
var RELATIVE_UNITS = { d: 1, w: 7, mo: 30.4, y: 365 };
var parseDate = (input, now) => {
  const relative = input.match(/^(\d+)(d|w|mo|y)$/);
  if (relative) {
    const [, amount, unit] = relative;
    if (amount === undefined || unit === undefined)
      return null;
    return now - Number(amount) * RELATIVE_UNITS[unit] * DAY;
  }
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? null : parsed;
};
var parseStrength = (raw) => {
  const match = raw.match(/^([<>])\s*(\d{1,3})$/);
  if (!match)
    return null;
  const [, op, value] = match;
  if (op === undefined || value === undefined)
    return null;
  const n = Number(value);
  if (n > 100)
    return null;
  return { op, value: n / 100 };
};
var parseQuery = (input, now) => {
  const draft = {
    terms: [],
    agent: [],
    cluster: [],
    type: [],
    kind: [],
    strength: null,
    asOf: null,
    before: null,
    after: null
  };
  for (const token of input.trim().split(/\s+/)) {
    if (!token)
      continue;
    const colon = token.indexOf(":");
    const key = colon > 0 ? token.slice(0, colon).toLowerCase() : null;
    if (key === null || !KEY_SET.has(key)) {
      draft.terms.push(token.toLowerCase());
      continue;
    }
    const value = token.slice(colon + 1);
    if (!value)
      continue;
    const filter = key;
    switch (filter) {
      case "agent":
      case "cluster":
      case "type":
      case "kind":
        draft[filter].push(value.toLowerCase());
        break;
      case "strength": {
        const bound = parseStrength(value);
        if (!bound) {
          return err({
            kind: "invalid-query",
            token,
            reason: "expected strength:<N or strength:>N, N between 0 and 100"
          });
        }
        draft.strength = bound;
        break;
      }
      case "asof":
      case "before":
      case "after": {
        const date = parseDate(value, now);
        if (date === null) {
          return err({
            kind: "invalid-query",
            token,
            reason: "expected a date like 2026-01-01 or a span like 30d, 2w, 6mo, 1y"
          });
        }
        if (filter === "asof")
          draft.asOf = date;
        else if (filter === "before")
          draft.before = date;
        else
          draft.after = date;
        break;
      }
    }
  }
  return ok({ ...EMPTY, ...draft });
};

// packages/core/src/strength.ts
var DAY2 = 86400000;
var USE_CEILING = 300;
var FRESHNESS_TAU_DAYS = 190;
var CORROBORATION_CEILING = 3;
var WEIGHTS = {
  floor: 0.17,
  used: 0.27,
  fresh: 0.34,
  corroborated: 0.22
};
var BOUNDS = { min: 0.04, max: 0.99 };
var PINNED_STRENGTH = BOUNDS.max;
var CHUNK_BOUNDS = { min: 0.15, max: 0.97 };
var clamp = (value, min, max) => Math.max(min, Math.min(max, value));
var factorsOf = (input) => ({
  used: clamp(Math.log1p(Math.max(0, input.hits)) / Math.log1p(USE_CEILING), 0, 1),
  fresh: Math.exp(-Math.max(0, input.now - input.lastReadAt) / (DAY2 * FRESHNESS_TAU_DAYS)),
  corroborated: clamp((Math.max(1, input.sourceCount) + Math.max(1, input.readerCount) - 2) / CORROBORATION_CEILING, 0, 1)
});
var strengthOf = (factors) => clamp(WEIGHTS.floor + WEIGHTS.used * factors.used + WEIGHTS.fresh * factors.fresh + WEIGHTS.corroborated * factors.corroborated, BOUNDS.min, BOUNDS.max);
var chunkStrength = (sourceTrust) => clamp(sourceTrust, CHUNK_BOUNDS.min, CHUNK_BOUNDS.max);

// packages/core/src/rows.ts
var SELECT_MEMORY = `
SELECT
  m.*,
  c.label AS cluster_label,
  c.color AS cluster_color,
  s.trust AS source_trust,
  (SELECT group_concat(agent_id, ',') FROM memory_readers r WHERE r.memory_id = m.id) AS readers,
  (SELECT CASE WHEN cf.a = m.id THEN cf.b ELSE cf.a END
     FROM conflicts cf
    WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id)
    LIMIT 1) AS conflict_with
FROM memories m
JOIN clusters c ON c.id = m.cluster_id
LEFT JOIN sources s ON s.id = m.source_id
`;
var split = (value) => value ? value.split(",").filter(Boolean) : [];
var hydrate = (row, now) => {
  const readers = split(row.readers);
  const factors = factorsOf({
    hits: row.hits,
    lastReadAt: row.last_read_at,
    sourceCount: row.source_count,
    readerCount: readers.length,
    now
  });
  const strength = row.kind === "chunk" ? chunkStrength(row.source_trust ?? 0.7) : row.pinned === 1 ? PINNED_STRENGTH : strengthOf(factors);
  return {
    id: row.id,
    text: row.text,
    kind: row.kind === "chunk" ? "chunk" : "claim",
    origin: row.origin === "doc" ? "doc" : "chat",
    clusterId: row.cluster_id,
    clusterLabel: row.cluster_label,
    clusterColor: row.cluster_color,
    writer: row.writer,
    readers,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    provenance: row.provenance,
    createdAt: row.created_at,
    lastReadAt: row.last_read_at,
    hits: row.hits,
    sourceCount: row.source_count,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    reviewedAt: row.reviewed_at,
    deletedAt: row.deleted_at,
    strength,
    factors,
    conflictWith: row.conflict_with
  };
};

// packages/core/src/schema.ts
var SCHEMA_VERSION = 2;
var DDL = `
-- v2 removed tags. Clusters already carry the taxonomy, and a second freeform
-- one only ever disagreed with the first. Dropped rather than left orphaned so
-- an old store does not carry a table nothing reads.
DROP TABLE IF EXISTS memory_tags;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clusters (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL,
  endpoint    TEXT NOT NULL DEFAULT '',
  read_scope  TEXT NOT NULL DEFAULT 'all clusters',
  write_scope TEXT NOT NULL DEFAULT 'all clusters',
  first_seen  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  ext         TEXT NOT NULL,
  cluster_id  TEXT NOT NULL REFERENCES clusters(id),
  ingested_by TEXT NOT NULL,
  bytes       INTEGER NOT NULL DEFAULT 0,
  trust       REAL NOT NULL DEFAULT 0.7,
  ingested_at INTEGER NOT NULL,
  dropped_at  INTEGER
);

CREATE TABLE IF NOT EXISTS memories (
  id           TEXT PRIMARY KEY,
  text         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('claim', 'chunk')),
  origin       TEXT NOT NULL CHECK (origin IN ('chat', 'doc')),
  cluster_id   TEXT NOT NULL REFERENCES clusters(id),
  writer       TEXT NOT NULL,
  source_id    TEXT REFERENCES sources(id),
  chunk_index  INTEGER,
  provenance   TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  last_read_at INTEGER NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 1,
  pinned       INTEGER NOT NULL DEFAULT 0,
  archived     INTEGER NOT NULL DEFAULT 0,
  reviewed_at  INTEGER,
  deleted_at   INTEGER
);

CREATE INDEX IF NOT EXISTS memories_live    ON memories (deleted_at, kind, cluster_id);
CREATE INDEX IF NOT EXISTS memories_created ON memories (created_at);
CREATE INDEX IF NOT EXISTS memories_pending ON memories (reviewed_at) WHERE kind = 'claim';
CREATE INDEX IF NOT EXISTS memories_source  ON memories (source_id);

CREATE TABLE IF NOT EXISTS memory_readers (
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  agent_id  TEXT NOT NULL,
  PRIMARY KEY (memory_id, agent_id)
);
CREATE INDEX IF NOT EXISTS memory_readers_agent ON memory_readers (agent_id);

CREATE TABLE IF NOT EXISTS links (
  a TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  b TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS links_b ON links (b);

CREATE TABLE IF NOT EXISTS conflicts (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  cluster_id  TEXT NOT NULL REFERENCES clusters(id),
  a           TEXT NOT NULL REFERENCES memories(id),
  b           TEXT NOT NULL REFERENCES memories(id),
  detector    REAL NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS conflicts_status ON conflicts (status);
CREATE INDEX IF NOT EXISTS conflicts_a ON conflicts (a);
CREATE INDEX IF NOT EXISTS conflicts_b ON conflicts (b);

-- Pairs the server suspects. A candidate is a question for an agent, never a verdict.
CREATE TABLE IF NOT EXISTS conflict_candidates (
  id         TEXT PRIMARY KEY,
  a          TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  b          TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  score      REAL NOT NULL,
  signals    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  judged_at  INTEGER,
  UNIQUE (a, b)
);
CREATE INDEX IF NOT EXISTS candidates_pending ON conflict_candidates (judged_at, score);

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        INTEGER NOT NULL,
  agent     TEXT NOT NULL,
  op        TEXT NOT NULL,
  memory_id TEXT,
  detail    TEXT NOT NULL DEFAULT '',
  ms        REAL
);
CREATE INDEX IF NOT EXISTS events_at ON events (at DESC);

-- Standalone rather than external-content: keeping an FTS index in sync by hand
-- inside the same transaction is less machinery than four triggers, and the
-- duplicated text costs little at personal-store scale.
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  text,
  tokenize = 'porter unicode61'
);
`;
var SEED_CLUSTERS = [
  { id: "prefs", label: "preferences", color: clusterColor.prefs },
  { id: "people", label: "people & orgs", color: clusterColor.people },
  { id: "code", label: "codebases", color: clusterColor.code },
  { id: "travel", label: "travel & places", color: clusterColor.travel },
  { id: "health", label: "health", color: clusterColor.health },
  { id: "money", label: "finances", color: clusterColor.money },
  { id: "home", label: "home & devices", color: clusterColor.home },
  { id: "reading", label: "reading & notes", color: clusterColor.reading },
  { id: "proc", label: "procedures", color: clusterColor.proc },
  { id: "projects", label: "projects", color: clusterColor.projects }
];

// packages/core/src/search.ts
var ftsTerm = (term) => `"${term.replace(/"/g, '""')}"`;
var ftsQuery = (terms, prefix) => {
  const usable = terms.filter((t) => /[\p{L}\p{N}]/u.test(t));
  if (usable.length === 0)
    return null;
  return usable.map((t) => prefix ? `${ftsTerm(t)}*` : ftsTerm(t)).join(" OR ");
};
var normaliseBm25 = (bm25) => {
  const positive = Math.max(0, -bm25);
  return positive / (positive + 1);
};
var trigrams = (text) => {
  const padded = ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
  const out = new Set;
  for (let i = 0;i + 3 <= padded.length; i += 1)
    out.add(padded.slice(i, i + 3));
  return out;
};
var fuzzyScore = (query, text) => {
  const q = trigrams(query);
  if (q.size === 0)
    return 0;
  const t = trigrams(text);
  let shared = 0;
  for (const g of q)
    if (t.has(g))
      shared += 1;
  return shared / q.size;
};
var FUZZY_FLOOR = 0.42;
var rank = (relevance, strength) => relevance * 0.75 + strength * 0.25;

// packages/core/src/store.ts
var SCAN_LIMIT = 5000;
var CANDIDATE_COMPARISONS = 500;
var asRow = (value) => value ?? null;
var openStore = (options) => {
  const db = new Database(options.path, { create: true, strict: true });
  const now = options.clock ?? (() => Date.now());
  const openedAt = now();
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  db.run(DDL);
  db.query("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("schema_version", String(SCHEMA_VERSION));
  if (options.seed !== false) {
    const insertCluster = db.query("INSERT OR IGNORE INTO clusters (id, label, color, created_at) VALUES (?, ?, ?, ?)");
    const seedAll = db.transaction(() => {
      for (const c of SEED_CLUSTERS)
        insertCluster.run(c.id, c.label, c.color, openedAt);
    });
    seedAll();
  }
  const record = (agent, op, memoryId, detail, ms) => {
    db.query("INSERT INTO events (at, agent, op, memory_id, detail, ms) VALUES (?, ?, ?, ?, ?, ?)").run(now(), agent, op, memoryId, detail, ms ?? null);
  };
  const clusterExists = (id) => db.query("SELECT 1 FROM clusters WHERE id = ?").get(id) !== null;
  const clusterIds = () => db.query("SELECT id FROM clusters ORDER BY id").all().map((r) => r.id);
  const requireCluster = (id) => clusterExists(id) ? ok(id) : err({ kind: "unknown-cluster", cluster: id, known: clusterIds() });
  const rowById = (id) => asRow(db.query(`${SELECT_MEMORY} WHERE m.id = ?`).get(id));
  const requireMemory = (id) => {
    const row = rowById(id);
    return row ? ok(row) : err({ kind: "unknown-memory", id });
  };
  const touchAgent = (id) => {
    const at = now();
    const existing = db.query("SELECT id FROM agents WHERE id = ?").get(id);
    if (existing) {
      db.query("UPDATE agents SET last_seen = ? WHERE id = ?").run(at, id);
      return;
    }
    const count = db.query("SELECT count(*) AS n FROM agents").get();
    const color2 = clusterPalette[count.n % clusterPalette.length] ?? "#868d95";
    db.query(`INSERT INTO agents (id, label, role, color, endpoint, first_seen, last_seen)
       VALUES (?, ?, '', ?, '', ?, ?)`).run(id, id, color2, at, at);
  };
  const addReader = (memoryId, agentId) => {
    db.query("INSERT OR IGNORE INTO memory_readers (memory_id, agent_id) VALUES (?, ?)").run(memoryId, agentId);
  };
  const indexText = (id, text) => {
    db.query("DELETE FROM memories_fts WHERE id = ?").run(id);
    db.query("INSERT INTO memories_fts (id, text) VALUES (?, ?)").run(id, text);
  };
  const proposeCandidates = (memory) => {
    if (memory.kind !== "claim")
      return;
    const peers = db.query(`SELECT id, text FROM memories
          WHERE cluster_id = ? AND kind = 'claim' AND deleted_at IS NULL
            AND archived = 0 AND id != ?
          ORDER BY last_read_at DESC LIMIT ?`).all(memory.cluster_id, memory.id, CANDIDATE_COMPARISONS);
    const insert = db.query(`INSERT OR IGNORE INTO conflict_candidates (id, a, b, score, signals, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`);
    const at = now();
    for (const peer of peers) {
      const s = suspect(memory.text, peer.text);
      if (!s)
        continue;
      const [a, b] = pairKey(memory.id, peer.id);
      const settled = db.query(`SELECT 1 FROM conflicts WHERE (a = ? AND b = ?) OR (a = ? AND b = ?)`).get(a, b, b, a);
      if (settled)
        continue;
      insert.run(newId("cc"), a, b, s.score, s.signals.join(", "), at);
    }
  };
  const openConflict = (a, b, clusterId, kind, detector, note) => {
    const id = newId("cf");
    db.query(`INSERT INTO conflicts (id, kind, cluster_id, a, b, detector, note, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`).run(id, kind, clusterId, a, b, detector, note, now());
    return conflicts.get(id);
  };
  const softDelete = (id, agent, reason) => {
    db.query("UPDATE memories SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL").run(now(), id);
    db.query(`UPDATE conflicts SET status = 'resolved', resolved_at = ?
        WHERE status = 'open' AND (a = ? OR b = ?)`).run(now(), id, id);
    record(agent, "memory.drop", id, reason);
  };
  const clusters = {
    list: () => db.query("SELECT id, label, color, created_at FROM clusters ORDER BY label").all().map((r) => {
      const row = r;
      return {
        id: row.id,
        label: row.label,
        color: row.color,
        createdAt: row.created_at
      };
    }),
    create: (input) => {
      const label = input.label.trim();
      if (!label)
        return err({
          kind: "invalid-input",
          issues: ["cluster label is empty"]
        });
      const id = slug(input.id ?? label);
      if (!id)
        return err({
          kind: "invalid-input",
          issues: ["cluster id is empty after slugify"]
        });
      const count = db.query("SELECT count(*) AS n FROM clusters").get();
      const color2 = input.color ?? clusterPalette[count.n % clusterPalette.length] ?? "#868d95";
      db.query("INSERT OR IGNORE INTO clusters (id, label, color, created_at) VALUES (?, ?, ?, ?)").run(id, label, color2, now());
      const created = clusters.list().find((c) => c.id === id);
      return created ? ok(created) : err({ kind: "unknown-cluster", cluster: id, known: clusterIds() });
    },
    rename: (id, label) => {
      if (!clusterExists(id))
        return err({
          kind: "unknown-cluster",
          cluster: id,
          known: clusterIds()
        });
      db.query("UPDATE clusters SET label = ? WHERE id = ?").run(label, id);
      const updated = clusters.list().find((c) => c.id === id);
      return updated ? ok(updated) : err({ kind: "unknown-cluster", cluster: id, known: clusterIds() });
    }
  };
  const agents = {
    list: () => db.query("SELECT * FROM agents ORDER BY last_seen DESC").all().map((r) => {
      const row = r;
      return {
        id: String(row["id"]),
        label: String(row["label"]),
        role: String(row["role"]),
        color: String(row["color"]),
        endpoint: String(row["endpoint"]),
        readScope: String(row["read_scope"]),
        writeScope: String(row["write_scope"]),
        firstSeen: Number(row["first_seen"]),
        lastSeen: Number(row["last_seen"])
      };
    }),
    describe: (id, patch) => {
      touchAgent(id);
      const sets = [];
      const values = [];
      const map = {
        role: patch.role,
        endpoint: patch.endpoint,
        read_scope: patch.readScope,
        write_scope: patch.writeScope,
        label: patch.label
      };
      for (const [column, value] of Object.entries(map)) {
        if (value !== undefined) {
          sets.push(`${column} = ?`);
          values.push(value);
        }
      }
      if (sets.length > 0) {
        db.query(`UPDATE agents SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
      }
      const found = agents.list().find((a) => a.id === id);
      if (!found)
        throw new Error(`agent ${id} vanished mid-write`);
      return found;
    },
    activity: (id) => {
      const dayAgo = now() - 86400000;
      const wrote = db.query(`SELECT count(*) AS n FROM memories WHERE writer = ? AND deleted_at IS NULL`).get(id);
      const calls = db.query("SELECT count(*) AS n FROM events WHERE agent = ? AND at >= ?").get(id, dayAgo);
      const searches = db.query(`SELECT count(*) AS n FROM events WHERE agent = ? AND op = 'memory.search' AND at >= ?`).get(id, dayAgo);
      const withHits = db.query(`SELECT count(*) AS n FROM events
            WHERE agent = ? AND op = 'memory.search' AND at >= ? AND detail NOT LIKE '0 %'`).get(id, dayAgo);
      const top = db.query(`SELECT c.id, c.label, c.color, count(*) AS n
             FROM memories m JOIN clusters c ON c.id = m.cluster_id
             JOIN memory_readers r ON r.memory_id = m.id
            WHERE r.agent_id = ? AND m.deleted_at IS NULL
            GROUP BY c.id ORDER BY n DESC LIMIT 4`).all(id);
      return {
        wrote: wrote.n,
        calls: calls.n,
        hitRate: searches.n === 0 ? null : withHits.n / searches.n,
        top
      };
    },
    overlap: () => {
      const rows = db.query(`SELECT r1.agent_id AS a, r2.agent_id AS b, count(*) AS n
             FROM memory_readers r1
             JOIN memory_readers r2 ON r1.memory_id = r2.memory_id AND r1.agent_id < r2.agent_id
             JOIN memories m ON m.id = r1.memory_id AND m.deleted_at IS NULL
            GROUP BY r1.agent_id, r2.agent_id ORDER BY n DESC`).all();
      return rows;
    }
  };
  const memories = {
    write: (input) => {
      const text = input.text.trim();
      if (!text)
        return err({ kind: "invalid-input", issues: ["text is empty"] });
      const cluster = requireCluster(input.cluster);
      if (cluster.isErr())
        return err(cluster.error);
      touchAgent(input.agent);
      const id = newId("m");
      const at = input.createdAt ?? now();
      const origin = input.origin ?? (input.sourceId ? "doc" : "chat");
      const insert = db.transaction(() => {
        db.query(`INSERT INTO memories
             (id, text, kind, origin, cluster_id, writer, source_id, chunk_index, provenance,
              created_at, last_read_at, hits, source_count, pinned, archived, reviewed_at, deleted_at)
           VALUES (?, ?, 'claim', ?, ?, ?, ?, NULL, ?, ?, ?, 0, 1, 0, 0, NULL, NULL)`).run(id, text, origin, cluster.value, input.agent, input.sourceId ?? null, input.provenance ?? "", at, at);
        addReader(id, input.agent);
        indexText(id, text);
      });
      insert();
      const row = rowById(id);
      if (!row)
        return err({ kind: "unknown-memory", id });
      record(input.agent, "memory.write", id, text);
      if (input.supersedes) {
        const prior = rowById(input.supersedes);
        if (prior) {
          openConflict(prior.id, id, row.cluster_id, "direct contradiction", 1, `declared by ${input.agent} on write`);
        }
      } else {
        proposeCandidates(row);
      }
      return ok(hydrate(rowById(id) ?? row, now()));
    },
    get: (id, readBy) => {
      const row = requireMemory(id);
      if (row.isErr())
        return err(row.error);
      if (readBy) {
        memories.countReads([id], readBy);
        record(readBy, "memory.get", id, row.value.text);
        return ok(hydrate(rowById(id) ?? row.value, now()));
      }
      return ok(hydrate(row.value, now()));
    },
    countReads: (ids, agent) => {
      if (ids.length === 0)
        return;
      touchAgent(agent);
      const at = now();
      const bump = db.query("UPDATE memories SET hits = hits + 1, last_read_at = ? WHERE id = ?");
      const apply = db.transaction(() => {
        for (const id of ids) {
          bump.run(at, id);
          addReader(id, agent);
        }
      });
      apply();
    },
    search: (input) => {
      const started = performance.now();
      const parsed = parseQuery(input.query, now());
      if (parsed.isErr())
        return err(parsed.error);
      const q = parsed.value;
      const mode = input.mode ?? "hybrid";
      const where = [];
      const params = [];
      if (q.asOf !== null) {
        where.push("m.created_at <= ?", "(m.deleted_at IS NULL OR m.deleted_at > ?)");
        params.push(q.asOf, q.asOf);
      } else {
        where.push("m.deleted_at IS NULL");
      }
      const kind = input.kind ?? "all";
      if (kind !== "all") {
        where.push("m.kind = ?");
        params.push(kind);
      }
      if (q.kind.length > 0) {
        where.push(`m.kind IN (${q.kind.map(() => "?").join(",")})`);
        params.push(...q.kind);
      }
      if (!input.includeArchived)
        where.push("m.archived = 0");
      if (input.pendingOnly)
        where.push("m.reviewed_at IS NULL AND m.kind = 'claim'");
      if (input.pinnedOnly)
        where.push("m.pinned = 1");
      if (input.conflictedOnly) {
        where.push("EXISTS (SELECT 1 FROM conflicts cf WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id))");
      }
      if (q.cluster.length > 0) {
        where.push(`m.cluster_id IN (${q.cluster.map(() => "?").join(",")})`);
        params.push(...q.cluster);
      }
      if (q.type.length > 0) {
        where.push(`m.origin IN (${q.type.map(() => "?").join(",")})`);
        params.push(...q.type);
      }
      if (q.agent.length > 0) {
        where.push(`EXISTS (SELECT 1 FROM memory_readers r WHERE r.memory_id = m.id AND r.agent_id IN (${q.agent.map(() => "?").join(",")}))`);
        params.push(...q.agent);
      }
      if (q.before !== null) {
        where.push("m.created_at < ?");
        params.push(q.before);
      }
      if (q.after !== null) {
        where.push("m.created_at > ?");
        params.push(q.after);
      }
      const relevance = new Map;
      if (q.terms.length > 0) {
        const expression = ftsQuery(q.terms, mode !== "keyword");
        if (expression && mode !== "fuzzy") {
          const matches = db.query(`SELECT id, bm25(memories_fts) AS score FROM memories_fts
                WHERE memories_fts MATCH ? ORDER BY score LIMIT ?`).all(expression, SCAN_LIMIT);
          for (const m of matches)
            relevance.set(m.id, normaliseBm25(m.score));
        }
        if (mode !== "keyword") {
          const phrase = q.terms.join(" ");
          const pool = db.query(`SELECT m.id, m.text FROM memories m WHERE ${where.join(" AND ")} LIMIT ?`).all(...params, SCAN_LIMIT);
          for (const row of pool) {
            if (relevance.has(row.id))
              continue;
            const score = fuzzyScore(phrase, row.text);
            if (score >= FUZZY_FLOOR)
              relevance.set(row.id, score * 0.6);
          }
        }
        if (relevance.size === 0) {
          return ok({
            hits: [],
            total: 0,
            tookMs: performance.now() - started,
            capped: false
          });
        }
        const ids = [...relevance.keys()];
        where.push(`m.id IN (${ids.map(() => "?").join(",")})`);
        params.push(...ids);
      }
      const clause = where.join(" AND ");
      const rows = db.query(`${SELECT_MEMORY} WHERE ${clause} LIMIT ?`).all(...params, SCAN_LIMIT);
      const capped = rows.length === SCAN_LIMIT;
      const at = now();
      let candidates = rows.map((row) => {
        const memory = hydrate(row, at);
        const relevanceScore = q.terms.length > 0 ? relevance.get(row.id) ?? 0 : 1;
        return { ...memory, score: rank(relevanceScore, memory.strength) };
      });
      if (q.strength) {
        const { op, value } = q.strength;
        candidates = candidates.filter((m) => op === "<" ? m.strength < value : m.strength > value);
      }
      const sort = input.sort ?? (q.terms.length > 0 ? "relevance" : "strength");
      const dir = input.dir === "asc" ? 1 : -1;
      const key = {
        relevance: (m) => m.score,
        strength: (m) => m.strength,
        hits: (m) => m.hits,
        created: (m) => m.createdAt,
        last: (m) => m.lastReadAt
      }[sort];
      candidates.sort((a, b) => (key(a) - key(b)) * dir);
      const offset = input.offset ?? 0;
      const limit = input.limit ?? 50;
      const page = candidates.slice(offset, offset + limit);
      if (input.countRead && input.agent) {
        memories.countReads(page.map((m) => m.id), input.agent);
      }
      if (input.agent) {
        record(input.agent, "memory.search", null, `${candidates.length} for "${input.query}"`, performance.now() - started);
      }
      return ok({
        hits: page,
        total: candidates.length,
        tookMs: performance.now() - started,
        capped
      });
    },
    update: (id, patch, agent) => {
      const existing = requireMemory(id);
      if (existing.isErr())
        return err(existing.error);
      if (patch.cluster !== undefined) {
        const cluster = requireCluster(patch.cluster);
        if (cluster.isErr())
          return err(cluster.error);
      }
      const apply = db.transaction(() => {
        if (patch.text !== undefined) {
          db.query("UPDATE memories SET text = ? WHERE id = ?").run(patch.text.trim(), id);
          indexText(id, patch.text.trim());
        }
        if (patch.cluster !== undefined) {
          db.query("UPDATE memories SET cluster_id = ? WHERE id = ?").run(patch.cluster, id);
        }
        if (patch.provenance !== undefined) {
          db.query("UPDATE memories SET provenance = ? WHERE id = ?").run(patch.provenance, id);
        }
      });
      apply();
      record(agent, "memory.update", id, patch.text ?? existing.value.text);
      const row = rowById(id);
      return row ? ok(hydrate(row, now())) : err({ kind: "unknown-memory", id });
    },
    pin: (ids, pinned, agent) => {
      const set = db.query("UPDATE memories SET pinned = ? WHERE id = ? AND kind = 'claim'");
      const apply = db.transaction(() => {
        for (const id of ids)
          set.run(pinned ? 1 : 0, id);
      });
      apply();
      record(agent, pinned ? "memory.pin" : "memory.unpin", null, `${ids.length} memories`);
      return ids.length;
    },
    archive: (ids, archived, agent) => {
      const set = db.query("UPDATE memories SET archived = ? WHERE id = ?");
      const apply = db.transaction(() => {
        for (const id of ids)
          set.run(archived ? 1 : 0, id);
      });
      apply();
      record(agent, archived ? "memory.archive" : "memory.unarchive", null, `${ids.length} memories`);
      return ids.length;
    },
    remove: (ids, agent) => {
      const apply = db.transaction(() => {
        for (const id of ids)
          softDelete(id, agent, "dropped");
      });
      apply();
      return ids.length;
    },
    merge: (ids, agent) => {
      if (ids.length < 2) {
        return err({
          kind: "invalid-input",
          issues: ["merge needs at least two memories"]
        });
      }
      const [keepId, ...rest] = ids;
      if (keepId === undefined)
        return err({ kind: "invalid-input", issues: ["no memories given"] });
      const keep = requireMemory(keepId);
      if (keep.isErr())
        return err(keep.error);
      const apply = db.transaction(() => {
        for (const id of rest) {
          const row2 = rowById(id);
          if (!row2)
            continue;
          db.query(`UPDATE memories SET hits = hits + ?, source_count = source_count + ?,
                    last_read_at = max(last_read_at, ?) WHERE id = ?`).run(row2.hits, row2.source_count, row2.last_read_at, keepId);
          db.query("INSERT OR IGNORE INTO memory_readers (memory_id, agent_id) SELECT ?, agent_id FROM memory_readers WHERE memory_id = ?").run(keepId, id);
          softDelete(id, agent, `merged into ${keepId}`);
        }
      });
      apply();
      record(agent, "memory.merge", keepId, `${ids.length} into 1`);
      const row = rowById(keepId);
      return row ? ok(hydrate(row, now())) : err({ kind: "unknown-memory", id: keepId });
    },
    link: (a, b, agent) => {
      const left = requireMemory(a);
      if (left.isErr())
        return err(left.error);
      const right = requireMemory(b);
      if (right.isErr())
        return err(right.error);
      const [x, y] = pairKey(a, b);
      db.query("INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)").run(x, y);
      record(agent, "memory.link", a, `linked to ${b}`);
      return ok(undefined);
    },
    related: (id, limit = 5) => {
      const linked = db.query(`${SELECT_MEMORY}
            WHERE m.deleted_at IS NULL AND m.id IN (
              SELECT CASE WHEN l.a = ? THEN l.b ELSE l.a END FROM links l WHERE l.a = ? OR l.b = ?
            ) LIMIT ?`).all(id, id, id, limit);
      if (linked.length > 0)
        return linked.map((r) => hydrate(r, now()));
      const source = rowById(id);
      if (!source)
        return [];
      const siblings = db.query(`${SELECT_MEMORY}
            WHERE m.deleted_at IS NULL AND m.cluster_id = ? AND m.id != ? AND m.kind = 'claim'
            ORDER BY m.hits DESC LIMIT ?`).all(source.cluster_id, id, limit);
      return siblings.map((r) => hydrate(r, now()));
    },
    exportJsonl: (ids) => ids.map((id) => rowById(id)).filter((row) => row !== null).map((row) => JSON.stringify(hydrate(row, now()))).join(`
`),
    facets: () => {
      const counts = (sql) => db.query(sql).all();
      return {
        origin: counts("SELECT origin, count(*) AS n FROM memories WHERE deleted_at IS NULL GROUP BY origin"),
        cluster: counts("SELECT cluster_id, count(*) AS n FROM memories WHERE deleted_at IS NULL GROUP BY cluster_id"),
        agent: counts(`SELECT r.agent_id, count(*) AS n FROM memory_readers r
             JOIN memories m ON m.id = r.memory_id AND m.deleted_at IS NULL GROUP BY r.agent_id`),
        flags: db.query(`SELECT
               (SELECT count(*) FROM memories WHERE deleted_at IS NULL AND pinned = 1) AS pinned,
               (SELECT count(*) FROM memories WHERE deleted_at IS NULL AND archived = 1) AS archived,
               (SELECT count(*) FROM conflicts WHERE status = 'open') AS conflicted,
               (SELECT count(*) FROM memories WHERE deleted_at IS NULL AND reviewed_at IS NULL AND kind = 'claim') AS pending`).get()
      };
    }
  };
  const review = {
    pending: (limit = 50) => db.query(`${SELECT_MEMORY}
              WHERE m.deleted_at IS NULL AND m.kind = 'claim' AND m.reviewed_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM conflicts cf WHERE cf.status = 'open' AND (cf.a = m.id OR cf.b = m.id))
              ORDER BY m.created_at DESC LIMIT ?`).all(limit).map((r) => hydrate(r, now())),
    keep: (id, agent) => {
      const row = requireMemory(id);
      if (row.isErr())
        return err(row.error);
      if (row.value.kind === "chunk")
        return err({ kind: "not-a-claim", id, actual: "chunk" });
      db.query("UPDATE memories SET reviewed_at = ? WHERE id = ?").run(now(), id);
      record(agent, "review.keep", id, row.value.text);
      const updated = rowById(id);
      return updated ? ok(hydrate(updated, now())) : err({ kind: "unknown-memory", id });
    },
    pin: (id, agent) => {
      const row = requireMemory(id);
      if (row.isErr())
        return err(row.error);
      if (row.value.kind === "chunk")
        return err({ kind: "not-a-claim", id, actual: "chunk" });
      db.query("UPDATE memories SET reviewed_at = ?, pinned = 1 WHERE id = ?").run(now(), id);
      record(agent, "review.pin", id, row.value.text);
      const updated = rowById(id);
      return updated ? ok(hydrate(updated, now())) : err({ kind: "unknown-memory", id });
    },
    drop: (id, agent) => {
      const row = requireMemory(id);
      if (row.isErr())
        return err(row.error);
      softDelete(id, agent, "dropped in review");
      return ok(undefined);
    },
    edit: (id, text, agent) => {
      const updated = memories.update(id, { text }, agent);
      if (updated.isErr())
        return updated;
      db.query("UPDATE memories SET reviewed_at = ? WHERE id = ?").run(now(), id);
      const row = rowById(id);
      return row ? ok(hydrate(row, now())) : err({ kind: "unknown-memory", id });
    }
  };
  const conflicts = {
    candidates: (limit = 20) => {
      const rows = db.query(`SELECT * FROM conflict_candidates
            WHERE judged_at IS NULL ORDER BY score DESC LIMIT ?`).all(limit);
      const at = now();
      return rows.flatMap((row) => {
        const a = rowById(row.a);
        const b = rowById(row.b);
        if (!a || !b || a.deleted_at !== null || b.deleted_at !== null)
          return [];
        return [
          {
            id: row.id,
            a: hydrate(a, at),
            b: hydrate(b, at),
            score: row.score,
            signals: row.signals ? row.signals.split(", ") : [],
            createdAt: row.created_at
          }
        ];
      });
    },
    judge: (input) => {
      const row = db.query("SELECT * FROM conflict_candidates WHERE id = ? AND judged_at IS NULL").get(input.candidateId);
      if (!row)
        return err({ kind: "unknown-candidate", id: input.candidateId });
      touchAgent(input.agent);
      db.query("UPDATE conflict_candidates SET judged_at = ? WHERE id = ?").run(now(), input.candidateId);
      if (input.verdict === "unrelated") {
        record(input.agent, "conflicts.judge", row.a, `not a conflict with ${row.b}`);
        return ok(null);
      }
      const a = rowById(row.a);
      if (!a)
        return err({ kind: "unknown-memory", id: row.a });
      const conflict = openConflict(row.a, row.b, a.cluster_id, input.kind ?? "direct contradiction", input.detector ?? 0.8, input.note ?? "");
      record(input.agent, "conflicts.judge", row.a, `conflicts with ${row.b}`);
      return ok(conflict);
    },
    get: (id) => {
      const row = db.query("SELECT * FROM conflicts WHERE id = ?").get(id);
      if (!row)
        return null;
      const a = rowById(row.a);
      const b = rowById(row.b);
      if (!a || !b)
        return null;
      const at = now();
      return {
        id: row.id,
        kind: row.kind,
        clusterId: row.cluster_id,
        a: hydrate(a, at),
        b: hydrate(b, at),
        detector: row.detector,
        note: row.note,
        status: row.status,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      };
    },
    open: (limit = 50) => db.query("SELECT id FROM conflicts WHERE status = 'open' ORDER BY created_at DESC LIMIT ?").all(limit).flatMap((r) => {
      const c = conflicts.get(r.id);
      return c ? [c] : [];
    }),
    resolve: (id, resolution, agent) => {
      const conflict = conflicts.get(id);
      if (conflict?.status !== "open")
        return err({ kind: "unknown-conflict", id });
      const at = now();
      const settle = (status) => {
        db.query("UPDATE conflicts SET status = ?, resolved_at = ? WHERE id = ?").run(status, at, id);
      };
      switch (resolution) {
        case "a":
        case "b": {
          const loser = resolution === "a" ? conflict.b : conflict.a;
          const winner = resolution === "a" ? conflict.a : conflict.b;
          settle("resolved");
          db.query("UPDATE memories SET reviewed_at = ? WHERE id = ?").run(at, winner.id);
          softDelete(loser.id, agent, `retired resolving conflict ${id}`);
          break;
        }
        case "merge": {
          settle("resolved");
          db.query(`UPDATE memories SET text = ?, hits = hits + ?, source_count = source_count + ?, reviewed_at = ?
              WHERE id = ?`).run(conflict.b.text, conflict.b.hits, conflict.b.sourceCount, at, conflict.a.id);
          indexText(conflict.a.id, conflict.b.text);
          softDelete(conflict.b.id, agent, `merged into ${conflict.a.id}`);
          break;
        }
        case "both": {
          settle("resolved");
          const [x, y] = pairKey(conflict.a.id, conflict.b.id);
          db.query("INSERT OR IGNORE INTO links (a, b) VALUES (?, ?)").run(x, y);
          db.query("UPDATE memories SET reviewed_at = ? WHERE id IN (?, ?)").run(at, conflict.a.id, conflict.b.id);
          break;
        }
        case "dismiss": {
          settle("dismissed");
          db.query("UPDATE memories SET reviewed_at = ? WHERE id IN (?, ?)").run(at, conflict.a.id, conflict.b.id);
          break;
        }
      }
      record(agent, "conflicts.resolve", conflict.a.id, `${resolution} on ${id}`);
      return ok(undefined);
    }
  };
  const sources = {
    list: () => db.query(`SELECT s.*,
                    (SELECT count(*) FROM memories m WHERE m.source_id = s.id AND m.kind = 'chunk' AND m.deleted_at IS NULL) AS chunk_count,
                    (SELECT count(*) FROM memories m WHERE m.source_id = s.id AND m.kind = 'claim' AND m.deleted_at IS NULL) AS claim_count,
                    (SELECT coalesce(sum(m.hits), 0) FROM memories m WHERE m.source_id = s.id AND m.deleted_at IS NULL) AS hits
               FROM sources s WHERE s.dropped_at IS NULL ORDER BY s.ingested_at DESC`).all().map((row) => ({
      id: String(row["id"]),
      filename: String(row["filename"]),
      ext: String(row["ext"]),
      clusterId: String(row["cluster_id"]),
      ingestedBy: String(row["ingested_by"]),
      bytes: Number(row["bytes"]),
      trust: Number(row["trust"]),
      ingestedAt: Number(row["ingested_at"]),
      droppedAt: null,
      chunkCount: Number(row["chunk_count"]),
      claimCount: Number(row["claim_count"]),
      hits: Number(row["hits"])
    })),
    chunks: (id, limit = 4) => db.query(`${SELECT_MEMORY}
              WHERE m.source_id = ? AND m.kind = 'chunk' AND m.deleted_at IS NULL
              ORDER BY m.chunk_index LIMIT ?`).all(id, limit).map((r) => hydrate(r, now())),
    claims: (id) => db.query(`${SELECT_MEMORY}
              WHERE m.source_id = ? AND m.kind = 'claim' AND m.deleted_at IS NULL
              ORDER BY m.created_at DESC`).all(id).map((r) => hydrate(r, now())),
    ingest: (input) => {
      const cluster = requireCluster(input.cluster);
      if (cluster.isErr())
        return err(cluster.error);
      if (!input.text.trim()) {
        return err({ kind: "invalid-input", issues: ["source text is empty"] });
      }
      touchAgent(input.agent);
      const id = newId("s");
      const at = now();
      const pieces = chunkText(input.text, DEFAULT_CHUNKING);
      const trust = Math.max(0, Math.min(1, input.trust ?? 0.75));
      const apply = db.transaction(() => {
        db.query(`INSERT INTO sources (id, filename, ext, cluster_id, ingested_by, bytes, trust, ingested_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.filename, extensionOf(input.filename), cluster.value, input.agent, input.bytes ?? input.text.length, trust, at);
        pieces.forEach((text, index) => {
          const chunkId = newId("c");
          db.query(`INSERT INTO memories
               (id, text, kind, origin, cluster_id, writer, source_id, chunk_index, provenance,
                created_at, last_read_at, hits, source_count, pinned, archived, reviewed_at, deleted_at)
             VALUES (?, ?, 'chunk', 'doc', ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, 0, ?, NULL)`).run(chunkId, text, cluster.value, input.agent, id, index + 1, `chunk ${index + 1} of ${pieces.length} \xB7 ${input.filename}`, at, at, at);
          addReader(chunkId, input.agent);
          indexText(chunkId, text);
        });
      });
      apply();
      record(input.agent, "sources.ingest", null, `${input.filename} \xB7 ${pieces.length} chunks`);
      const source = sources.list().find((s) => s.id === id);
      return source ? ok({ source, chunks: pieces.length }) : err({ kind: "unknown-source", id });
    },
    trust: (id, value, agent) => {
      const exists = db.query("SELECT 1 FROM sources WHERE id = ?").get(id);
      if (!exists)
        return err({ kind: "unknown-source", id });
      db.query("UPDATE sources SET trust = ? WHERE id = ?").run(Math.max(0, Math.min(1, value)), id);
      record(agent, "sources.trust", null, `${id} \u2192 ${Math.round(value * 100)}`);
      return ok(undefined);
    },
    drop: (id, agent) => {
      const exists = db.query("SELECT filename FROM sources WHERE id = ? AND dropped_at IS NULL").get(id);
      if (!exists)
        return err({ kind: "unknown-source", id });
      const chunkIds = db.query("SELECT id FROM memories WHERE source_id = ? AND kind = 'chunk' AND deleted_at IS NULL").all(id).map((r) => r.id);
      const claimIds = db.query("SELECT id FROM memories WHERE source_id = ? AND kind = 'claim' AND deleted_at IS NULL").all(id).map((r) => r.id);
      const apply = db.transaction(() => {
        for (const chunkId of chunkIds)
          softDelete(chunkId, agent, `source ${id} dropped`);
        for (const claimId of claimIds) {
          db.query("UPDATE memories SET reviewed_at = NULL WHERE id = ?").run(claimId);
        }
        db.query("UPDATE sources SET dropped_at = ? WHERE id = ?").run(now(), id);
      });
      apply();
      record(agent, "sources.drop", null, `${exists.filename} \xB7 ${chunkIds.length} chunks removed`);
      return ok({ chunks: chunkIds.length, flagged: claimIds.length });
    }
  };
  const events = (limit = 20) => db.query("SELECT * FROM events ORDER BY at DESC, id DESC LIMIT ?").all(limit).map((row) => ({
    id: Number(row["id"]),
    at: Number(row["at"]),
    agent: String(row["agent"]),
    op: String(row["op"]),
    memoryId: row["memory_id"] === null ? null : String(row["memory_id"]),
    detail: String(row["detail"])
  }));
  const stats = () => {
    const startOfDay = new Date(now()).setHours(0, 0, 0, 0);
    const one = (sql, ...params) => db.query(sql).get(...params);
    const totals = one(`SELECT count(*) AS memories,
              sum(kind = 'claim') AS claims,
              sum(kind = 'chunk') AS chunks,
              sum(kind = 'claim' AND reviewed_at IS NULL) AS pending
         FROM memories WHERE deleted_at IS NULL`);
    const searchTimes = db.query(`SELECT ms FROM events WHERE op = 'memory.search' AND ms IS NOT NULL AND at >= ? ORDER BY ms`).all(startOfDay).map((r) => r.ms);
    return {
      memories: totals.memories,
      claims: totals.claims ?? 0,
      chunks: totals.chunks ?? 0,
      pending: totals.pending ?? 0,
      conflicts: one("SELECT count(*) AS n FROM conflicts WHERE status = 'open'").n,
      candidates: one("SELECT count(*) AS n FROM conflict_candidates WHERE judged_at IS NULL").n,
      sources: one("SELECT count(*) AS n FROM sources WHERE dropped_at IS NULL").n,
      agents: one("SELECT count(*) AS n FROM agents").n,
      requestsToday: one("SELECT count(*) AS n FROM events WHERE at >= ?", startOfDay).n,
      diskBytes: options.path === ":memory:" ? 0 : Bun.file(options.path).size ?? 0,
      startedAt: openedAt,
      p50SearchMs: searchTimes[Math.floor(searchTimes.length / 2)] ?? 0,
      lastWriteAt: one("SELECT max(at) AS at FROM events WHERE op IN ('memory.write', 'sources.ingest')").at ?? null
    };
  };
  const timeline = (buckets = 60) => {
    const span = db.query("SELECT min(created_at) AS lo, max(created_at) AS hi FROM memories").get();
    if (span.lo === null || span.hi === null)
      return [];
    const lo = span.lo;
    const width = Math.max(1, (span.hi - lo) / buckets);
    const rows = db.query(`SELECT cast((created_at - ?) / ? AS INTEGER) AS bucket, count(*) AS n
           FROM memories WHERE deleted_at IS NULL GROUP BY bucket`).all(lo, width);
    const counts = new Map(rows.map((r) => [Math.min(r.bucket, buckets - 1), r.n]));
    return Array.from({ length: buckets }, (_, i) => ({
      at: lo + i * width,
      n: counts.get(i) ?? 0
    }));
  };
  return {
    db,
    now,
    close: () => db.close(),
    clusters,
    agents,
    memories,
    review,
    conflicts,
    sources,
    events,
    stats,
    timeline,
    parse: (query) => parseQuery(query, now())
  };
};
// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || undefined;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err2) {
          if (err2 instanceof Error && onError) {
            context.error = err2;
            res = await onError(err2, context);
            isError = true;
          } else {
            throw err2;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/utils/body.js
var isRawRequest = (request) => ("headers" in request);
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  if (!isRawRequest(request) && request.bodyCache.formData) {
    return convertFormDataToBodyData(await request.bodyCache.formData, options);
  }
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== undefined) {
    if (Array.isArray(form[key])) {
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match, index) => {
    const mark = `@${index}`;
    groups.push([mark, match]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1;i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1;j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match[1], new RegExp(`^${match[2]}(?=/${next})`)] : [label, match[1], new RegExp(`^${match[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decoder(match);
      } catch {
        return match;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (;i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? undefined : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var tryDecodeURIComponent = (str) => str.indexOf("%") !== -1 ? tryDecode(str, decodeURIComponent_) : str;
var _decodeURI = (value) => {
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return tryDecodeURIComponent(value);
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && key.indexOf("%") === -1 && key.indexOf("+") === -1) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? undefined : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return;
    }
  }
  const results = /* @__PURE__ */ Object.create(null);
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? undefined : nextKeyIndex : valueIndex);
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? undefined : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/request.js
var HonoRequest = class {
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && tryDecodeURIComponent(param);
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== undefined) {
        decoded[key] = tryDecodeURIComponent(value);
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? undefined;
    }
    const headerData = /* @__PURE__ */ Object.create(null);
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    for (const anyCachedKey in bodyCache) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw[key]();
  };
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    (this.#validatedData ??= {})[target] = data;
  }
  valid(target) {
    return this.#validatedData?.[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then((res) => Promise.all(res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers
    });
  }
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  setLayout = (layout) => this.#layout = layout;
  getLayout = () => this.#layout;
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers;
    if (value === undefined) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map;
    this.#var.set(key, value);
  };
  get = (key) => {
    return this.#var ? this.#var.get(key) : undefined;
  };
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    let responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders;
    if (typeof arg === "object" && arg.headers) {
      responseHeaders ??= new Headers;
      for (const [key, value] of new Headers(arg.headers)) {
        if (key === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      if (!responseHeaders) {
        let count = 0;
        for (const k in headers) {
          if (++count > 1 || typeof headers[k] !== "string") {
            responseHeaders = new Headers;
            break;
          }
        }
      }
      if (responseHeaders) {
        for (const k in headers) {
          const v = headers[k];
          if (typeof v === "string") {
            responseHeaders.set(k, v);
          } else {
            responseHeaders.delete(k);
            for (const v2 of v) {
              responseHeaders.append(k, v2);
            }
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, {
      status,
      headers: responseHeaders ?? headers
    });
  }
  newResponse = (...args) => this.#newResponse(...args);
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  };
  json = (object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  redirect = (location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  };
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch", "query"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err2, c) => {
  if ("getResponse" in err2) {
    const res = err2.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err2);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  query;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app) {
    const subApp = this.basePath(path);
    app.routes.map((r) => {
      let handler;
      if (app.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = undefined;
      try {
        executionContext = c.executionCtx;
      } catch {}
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== undefined ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err2, c) {
    if (err2 instanceof Error) {
      return this.errorHandler(err2, c);
    }
    throw err2;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err2) {
        return this.#handleError(err2, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err2) => this.#handleError(err2, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        }
        return context.res;
      } catch (err2) {
        return this.#handleError(err2, c);
      }
    })();
  }
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  };
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, undefined, event.request.method));
    });
  };
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = (method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  };
  this.match = match2;
  return match2(method, path);
}

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return b === TAIL_WILDCARD_REG_EXP_STR ? -1 : 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, isStatic) {
    let node = this;
    for (let i = 0, len = tokens.length;i < len; i++) {
      const token = tokens[i];
      const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : null : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
      let nextNode;
      if (pattern) {
        const name = pattern[1];
        let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
        if (name && pattern[2]) {
          if (regexpStr === ".*") {
            throw PATH_ERROR;
          }
          regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
          if (/\((?!\?:)/.test(regexpStr)) {
            throw PATH_ERROR;
          }
          if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) {
            throw PATH_ERROR;
          }
        }
        nextNode = node.#children[regexpStr];
        if (!nextNode) {
          if (regexpStr !== ONLY_WILDCARD_REG_EXP_STR && regexpStr !== TAIL_WILDCARD_REG_EXP_STR) {
            for (const k in node.#children) {
              if ((regexpStr.length > 1 || k.length > 1) && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
                throw PATH_ERROR;
              }
            }
          }
          nextNode = node.#children[regexpStr] = new _Node;
        }
        if (name !== "") {
          nextNode.#varIndex ??= context.varIndex++;
          paramMap.push([name, nextNode.#varIndex]);
        }
      } else {
        nextNode = node.#children[token];
        if (!nextNode) {
          for (const k in node.#children) {
            if (k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR) {
              throw PATH_ERROR;
            }
          }
          nextNode = node.#children[token] = new _Node;
        }
      }
      node = nextNode;
    }
    if (node.#index !== undefined) {
      throw PATH_ERROR;
    }
    node.#index = isStatic ? -1 : index;
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      const childStr = c.buildRegExpStr();
      return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
    }).filter(Boolean);
    if (typeof this.#index === "number" && this.#index !== -1) {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node;
  #index = 0;
  paths = /* @__PURE__ */ Object.create(null);
  insert(path, isStatic) {
    if (isStatic) {
      this.#root.insert(path.split(""), 0, [], this.#context, true);
      return;
    }
    const paramAssoc = [];
    const groups = [];
    let markedPath = path;
    for (let i = 0;; ) {
      let replaced = false;
      markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1;i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1;j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
    this.paths[path] = [this.#index++, paramAssoc];
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== undefined) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== undefined) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/reg-exp-router/router.js
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(path === "*" ? "" : `^${path.replace(/\/\*$|([.\\+*[^\]$()])/g, (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)")}$`);
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  #tries;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#tries = { [METHOD_NAME_ALL]: new Trie };
  }
  #insertPath(method, path) {
    try {
      this.#tries[method].insert(path, !/\*|\/:/.test(path));
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      this.#tries[method] = new Trie;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
          this.#insertPath(method, p);
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      Object.keys(middleware).forEach((m) => {
        if ((method === METHOD_NAME_ALL || method === m) && !middleware[m][path]) {
          this.#insertPath(m, path);
          middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        }
      });
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach((p) => re.test(p) && routes[m][p].push([handler, paramCount]));
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length;i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          if (!routes[m][path2]) {
            this.#insertPath(m, path2);
            routes[m][path2] = [
              ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
            ];
          }
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = this.#tries = undefined;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const middleware = this.#middleware[method];
    const routes = this.#routes[method];
    const trie = this.#tries[method];
    const staticMap = /* @__PURE__ */ Object.create(null);
    const handlerData = [];
    [middleware, routes].forEach((r) => {
      for (const path in r) {
        const handlers = r[path];
        const pathData = trie.paths[path];
        if (!pathData) {
          staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
          continue;
        }
        const paramAssoc = pathData[1];
        handlerData[pathData[0]] = handlers.map(([h, paramCount]) => {
          const paramIndexMap = /* @__PURE__ */ Object.create(null);
          paramCount -= 1;
          for (;paramCount >= 0; paramCount--) {
            const [key, value] = paramAssoc[paramCount];
            paramIndexMap[key] = value;
          }
          return [h, paramIndexMap];
        });
      }
    });
    const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
    for (let i = 0, len = handlerData.length;i < len; i++) {
      for (let j = 0, len2 = handlerData[i].length;j < len2; j++) {
        const map = handlerData[i][j]?.[1];
        if (!map) {
          continue;
        }
        const keys = Object.keys(map);
        for (let k = 0, len3 = keys.length;k < len3; k++) {
          map[keys[k]] = paramReplacementMap[map[keys[k]]];
        }
      }
    }
    const handlerMap = [];
    for (const i in indexReplacementMap) {
      handlerMap[i] = handlerData[indexReplacementMap[i]];
    }
    return [regexp, handlerMap, staticMap];
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/reg-exp-router/prepared-router.js
var PreparedRegExpRouter = class {
  name = "PreparedRegExpRouter";
  #matchers;
  #relocateMap;
  constructor(matchers, relocateMap) {
    this.#matchers = matchers;
    this.#relocateMap = relocateMap;
  }
  #addWildcard(method, handlerData) {
    const matcher = this.#matchers[method];
    matcher[1].forEach((list) => list && list.push(handlerData));
    Object.values(matcher[2]).forEach((list) => list[0].push(handlerData));
  }
  #addPath(method, path, handler, indexes, map) {
    const matcher = this.#matchers[method];
    if (!map) {
      matcher[2][path][0].push([handler, {}]);
    } else {
      indexes.forEach((index) => {
        if (typeof index === "number") {
          matcher[1][index].push([handler, map]);
        } else {
          matcher[2][index || path][0].push([handler, map]);
        }
      });
    }
  }
  add(method, path, handler) {
    if (!this.#matchers[method]) {
      const all = this.#matchers[METHOD_NAME_ALL];
      const staticMap = {};
      for (const key in all[2]) {
        staticMap[key] = [all[2][key][0].slice(), emptyParam];
      }
      this.#matchers[method] = [
        all[0],
        all[1].map((list) => Array.isArray(list) ? list.slice() : 0),
        staticMap
      ];
    }
    if (path === "/*" || path === "*") {
      const handlerData = [handler, {}];
      if (method === METHOD_NAME_ALL) {
        for (const m in this.#matchers) {
          this.#addWildcard(m, handlerData);
        }
      } else {
        this.#addWildcard(method, handlerData);
      }
      return;
    }
    const data = this.#relocateMap[path];
    if (!data) {
      throw new Error(`Path ${path} is not registered`);
    }
    for (const [indexes, map] of data) {
      if (method === METHOD_NAME_ALL) {
        for (const m in this.#matchers) {
          this.#addPath(m, path, handler, indexes, map);
        }
      } else {
        this.#addPath(method, path, handler, indexes, map);
      }
    }
  }
  buildAllMatchers() {
    return this.#matchers;
  }
  match = match;
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (;i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length;i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = undefined;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length;i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2;
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length;i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== undefined) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length;i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0;i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length;j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length;k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0;p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (m[0].length === restPathString.length && child.#children["*"]) {
                this.#pushHandlerSets(handlerSets, child.#children["*"], method, node.#params, params);
              }
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2;
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length;i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/.bun/hono@4.13.0/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter, new TrieRouter]
    });
  }
};

// packages/server/src/api.ts
var status = (failure) => {
  switch (failure.kind) {
    case "unknown-memory":
    case "unknown-source":
    case "unknown-conflict":
    case "unknown-candidate":
    case "unknown-cluster":
      return 404;
    default:
      return 400;
  }
};
var send = (result) => result.match((value) => ({ body: value, code: 200 }), (failure) => ({
  body: { error: explain(failure), kind: failure.kind },
  code: status(failure)
}));
var createApi = (store) => {
  const api = new Hono2;
  api.get("/stats", (c) => c.json({ ...store.stats(), clusters: store.clusters.list() }));
  api.get("/clusters", (c) => c.json(store.clusters.list()));
  api.post("/clusters", async (c) => {
    const body = await c.req.json();
    if (!body.label)
      return c.json({ error: "label is required" }, 400);
    const { body: out, code } = send(store.clusters.create({
      label: body.label,
      ...body.id ? { id: body.id } : {},
      ...body.color ? { color: body.color } : {}
    }));
    return c.json(out, code);
  });
  api.get("/agents", (c) => c.json({
    agents: store.agents.list().map((a) => ({ ...a, ...store.agents.activity(a.id) })),
    overlap: store.agents.overlap()
  }));
  api.get("/events", (c) => c.json(store.events(Number(c.req.query("limit") ?? 20))));
  api.get("/facets", (c) => c.json(store.memories.facets()));
  api.get("/timeline", (c) => c.json(store.timeline(Number(c.req.query("buckets") ?? 60))));
  api.get("/search", (c) => {
    const q = c.req.query();
    const { body, code } = send(store.memories.search({
      query: q["q"] ?? "",
      countRead: false,
      limit: Number(q["limit"] ?? 100),
      offset: Number(q["offset"] ?? 0),
      ...q["mode"] ? { mode: q["mode"] } : {},
      ...q["kind"] ? { kind: q["kind"] } : {},
      ...q["sort"] ? { sort: q["sort"] } : {},
      ...q["dir"] ? { dir: q["dir"] } : {},
      ...q["archived"] === "1" ? { includeArchived: true } : {},
      ...q["pending"] === "1" ? { pendingOnly: true } : {},
      ...q["pinned"] === "1" ? { pinnedOnly: true } : {},
      ...q["conflicted"] === "1" ? { conflictedOnly: true } : {}
    }));
    return c.json(body, code);
  });
  api.get("/memories/:id", (c) => {
    const { body, code } = send(store.memories.get(c.req.param("id")));
    if (code !== 200)
      return c.json(body, code);
    return c.json({
      memory: body,
      related: store.memories.related(c.req.param("id"), 5)
    });
  });
  api.patch("/memories/:id", async (c) => {
    const patch = await c.req.json();
    const { body, code } = send(store.memories.update(c.req.param("id"), {
      ...patch.text !== undefined ? { text: patch.text } : {},
      ...patch.cluster !== undefined ? { cluster: patch.cluster } : {}
    }, patch.by ?? "human"));
    return c.json(body, code);
  });
  api.post("/memories/bulk", async (c) => {
    const body = await c.req.json();
    const by = body.by ?? "human";
    const ids = body.ids ?? [];
    if (ids.length === 0)
      return c.json({ error: "no memories selected" }, 400);
    switch (body.op) {
      case "pin":
      case "unpin":
        return c.json({
          affected: store.memories.pin(ids, body.op === "pin", by)
        });
      case "archive":
      case "unarchive":
        return c.json({
          affected: store.memories.archive(ids, body.op === "archive", by)
        });
      case "drop":
        return c.json({ affected: store.memories.remove(ids, by) });
      case "merge": {
        const { body: out, code } = send(store.memories.merge(ids, by));
        return c.json(out, code);
      }
      case "export":
        return new Response(store.memories.exportJsonl(ids), {
          headers: {
            "content-type": "application/x-ndjson",
            "content-disposition": 'attachment; filename="ledger-export.jsonl"'
          }
        });
      default:
        return c.json({ error: `unknown operation "${String(body.op)}"` }, 400);
    }
  });
  api.get("/review", (c) => c.json({
    claims: store.review.pending(Number(c.req.query("limit") ?? 50)),
    conflicts: store.conflicts.open(50),
    candidates: store.conflicts.candidates(20)
  }));
  api.post("/review/:id/:action", async (c) => {
    const id = c.req.param("id");
    const action = c.req.param("action");
    const by = c.req.query("by") ?? "human";
    if (action === "keep") {
      const { body, code } = send(store.review.keep(id, by));
      return c.json(body, code);
    }
    if (action === "pin") {
      const { body, code } = send(store.review.pin(id, by));
      return c.json(body, code);
    }
    if (action === "drop") {
      const dropped = store.review.drop(id, by);
      return dropped.isOk() ? c.json({ dropped: id }) : c.json({ error: explain(dropped.error) }, status(dropped.error));
    }
    if (action === "edit") {
      const { text } = await c.req.json();
      if (text === undefined)
        return c.json({ error: "text is required" }, 400);
      const { body, code } = send(store.review.edit(id, text, by));
      return c.json(body, code);
    }
    return c.json({ error: `unknown review action "${action}"` }, 400);
  });
  api.post("/conflicts/:id/resolve", async (c) => {
    const { resolution, by } = await c.req.json();
    if (!resolution)
      return c.json({ error: "resolution is required" }, 400);
    const resolved = store.conflicts.resolve(c.req.param("id"), resolution, by ?? "human");
    return resolved.isOk() ? c.json({ resolved: c.req.param("id"), resolution }) : c.json({ error: explain(resolved.error) }, status(resolved.error));
  });
  api.get("/sources", (c) => c.json(store.sources.list().map((s) => ({
    ...s,
    chunkPreview: store.sources.chunks(s.id, 4),
    claimList: store.sources.claims(s.id)
  }))));
  api.post("/sources/:id/trust", async (c) => {
    const { trust, by } = await c.req.json();
    if (typeof trust !== "number")
      return c.json({ error: "trust must be a number 0..1" }, 400);
    const updated = store.sources.trust(c.req.param("id"), trust, by ?? "human");
    return updated.isOk() ? c.json({ id: c.req.param("id"), trust }) : c.json({ error: explain(updated.error) }, status(updated.error));
  });
  api.delete("/sources/:id", (c) => {
    const { body, code } = send(store.sources.drop(c.req.param("id"), c.req.query("by") ?? "human"));
    return c.json(body, code);
  });
  api.get("/graph", (c) => {
    const q = c.req.query();
    const found = store.memories.search({
      query: q["q"] ?? "",
      limit: Number(q["limit"] ?? 4000),
      countRead: false,
      kind: q["kind"] ?? "claim",
      ...q["archived"] === "1" ? { includeArchived: true } : {},
      ...q["pending"] === "1" ? { pendingOnly: true } : {},
      ...q["pinned"] === "1" ? { pinnedOnly: true } : {},
      ...q["conflicted"] === "1" ? { conflictedOnly: true } : {}
    });
    if (found.isErr())
      return c.json({ error: explain(found.error) }, status(found.error));
    const ids = new Set(found.value.hits.map((m) => m.id));
    const links = store.db.query("SELECT a, b FROM links").all().filter((l) => ids.has(l.a) && ids.has(l.b));
    return c.json({
      nodes: found.value.hits.map((m) => ({
        id: m.id,
        text: m.text,
        cluster: m.clusterId,
        color: m.clusterColor,
        writer: m.writer,
        strength: m.strength,
        hits: m.hits,
        createdAt: m.createdAt,
        pinned: m.pinned,
        conflict: m.conflictWith !== null,
        kind: m.kind
      })),
      links,
      clusters: store.clusters.list(),
      capped: found.value.capped
    });
  });
  return api;
};

// packages/server/src/index.ts
var DEFAULT_PORT = 7444;
var createServer = (options) => {
  const store = openStore(options.store);
  const app = new Hono2;
  app.route("/api", createApi(store));
  app.get("/health", (c) => c.json({ ok: true, memories: store.stats().memories, version: "0.1.0" }));
  if (options.ui) {
    const root = options.ui;
    app.get("*", async (c) => {
      const path = new URL(c.req.url).pathname;
      const candidate = Bun.file(`${root}${path === "/" ? "/index.html" : path}`);
      if (await candidate.exists())
        return new Response(candidate);
      return new Response(Bun.file(`${root}/index.html`));
    });
  }
  const port = options.port ?? DEFAULT_PORT;
  const hostname = options.host ?? "127.0.0.1";
  return {
    store,
    app,
    listen: () => {
      const server = Bun.serve({
        port,
        hostname,
        fetch: app.fetch,
        idleTimeout: 60
      });
      return {
        url: `http://${hostname}:${port}`,
        stop: async () => {
          await server.stop(true);
          store.close();
        }
      };
    }
  };
};

// packages/cli/src/paths.ts
import { homedir } from "os";
import { join } from "path";
var storePath = () => process.env["LEDGER_DB"] ?? join(homedir(), ".ledger", "ledger.db");
var defaultAgent = () => process.env["LEDGER_AGENT"] ?? "agent";
var uiCandidates = () => [
  join(import.meta.dir, "ui"),
  join(import.meta.dir, "..", "..", "ui", "dist")
];
var findUi = async () => {
  for (const candidate of uiCandidates()) {
    if (await Bun.file(join(candidate, "index.html")).exists())
      return candidate;
  }
  return null;
};

// packages/cli/src/term.ts
var supportsColor = () => process.env["NO_COLOR"] === undefined && Boolean(process.stdout.isTTY);
var rgb = (hex) => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
var paint = (hex, text) => {
  if (!supportsColor())
    return text;
  const [r, g, b] = rgb(hex);
  return `\x1B[38;2;${r};${g};${b}m${text}\x1B[39m`;
};
var dim = (text) => paint(color.textFaint, text);
var muted = (text) => paint(color.textDim, text);
var accent = (text) => paint(color.accent, text);
var danger = (text) => paint(color.danger, text);
var warn = (text) => paint(color.warn, text);
var bold = (text) => supportsColor() ? `\x1B[1m${text}\x1B[22m` : text;
var strengthTint = (strength) => strength > 0.7 ? color.accent : strength > 0.4 ? "#d9a03c" : color.danger;
var bar = (fraction, width = 10) => {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return paint(strengthTint(fraction), "\u2588".repeat(filled)) + dim("\u2591".repeat(width - filled));
};
var truncate = (text, width) => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}\u2026`;
};
var ago = (from, now) => {
  const days = (now - from) / 86400000;
  if (days < 1)
    return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 60)
    return `${Math.round(days)}d`;
  return `${Math.round(days / 30.4)}mo`;
};
var write = (line = "") => {
  process.stdout.write(`${line}
`);
};
var heading = (title, subtitle) => {
  write();
  write(`${bold(accent("\u258D"))} ${bold(title)}${subtitle ? `  ${dim(subtitle)}` : ""}`);
};

// packages/cli/src/review-tui.ts
var KEYS = {
  claim: `${accent("a")} keep   ${accent("e")} edit   ${danger("d")} drop   ${accent("p")} pin`,
  conflict: `${accent("1")} keep A   ${accent("2")} keep B   ${accent("b")} keep both   ${muted("n")} not a conflict   ${accent("m")} merge`,
  nav: `${dim("\u2191/\u2193 or j/k move \xB7 q quit")}`
};
var renderClaim = (m, now) => {
  write();
  write(`  ${dim(m.writer)}  ${dim(ago(m.createdAt, now))}  ${dim("\xB7")}  ${muted(m.clusterLabel)}  ${bar(m.strength, 8)} ${dim(String(Math.round(m.strength * 100)))}`);
  write(`  ${bold(m.text)}`);
  if (m.provenance)
    write(`  ${dim(m.provenance)}`);
};
var renderConflict = (c, now) => {
  write();
  write(`  ${warn("\u25B2")} ${warn(c.kind)}  ${muted(c.a.clusterLabel)}  ${dim(`detector ${Math.round(c.detector * 100)}`)}`);
  for (const [slot, m] of [
    ["A", c.a],
    ["B", c.b]
  ]) {
    write();
    write(`  ${bold(slot)}  ${dim(m.writer)} ${dim(ago(m.createdAt, now))}  ${bar(m.strength, 6)} ${dim(String(Math.round(m.strength * 100)))}`);
    write(`     ${m.text}`);
  }
  if (c.note)
    write(`
  ${dim(c.note)}`);
};
var prompt = async (question) => {
  process.stdout.write(`  ${question} `);
  for await (const line of console)
    return line;
  return "";
};
var readKey = async () => {
  const stdin = process.stdin;
  if (!stdin.isTTY)
    return null;
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve) => {
    stdin.once("data", (data) => {
      stdin.setRawMode(false);
      stdin.pause();
      const key = data.toString();
      if (key === "" || key === "q")
        resolve(null);
      else
        resolve(key);
    });
  });
};
var clear = () => {
  process.stdout.write("[2J[H");
};
var runReview = async (store) => {
  let lane = "claims";
  let index = 0;
  for (;; ) {
    const claims = store.review.pending(200);
    const conflicts = store.conflicts.open(200);
    const now = store.now();
    if (claims.length === 0 && conflicts.length === 0) {
      clear();
      write();
      write(`  ${accent("QUEUE CLEAR")}`);
      write(`  ${muted(`Your agents are writing straight through. ${store.stats().memories} memories on this machine.`)}`);
      write();
      return;
    }
    if (lane === "claims" && claims.length === 0)
      lane = "conflicts";
    if (lane === "conflicts" && conflicts.length === 0)
      lane = "claims";
    const list = lane === "claims" ? claims : conflicts;
    index = Math.max(0, Math.min(index, list.length - 1));
    const current = list[index];
    if (!current)
      return;
    clear();
    write();
    write(`  ${bold("What your agents learned")}   ${lane === "claims" ? accent(`CLAIMS ${claims.length}`) : dim(`claims ${claims.length}`)}  ${lane === "conflicts" ? warn(`CONFLICTS ${conflicts.length}`) : dim(`conflicts ${conflicts.length}`)}`);
    write(`  ${dim(`${index + 1} of ${list.length}`)}   ${dim("tab switches lane")}`);
    if (lane === "claims")
      renderClaim(current, now);
    else
      renderConflict(current, now);
    write();
    write(`  ${lane === "claims" ? KEYS.claim : KEYS.conflict}`);
    write(`  ${KEYS.nav}`);
    const key = await readKey();
    if (key === null) {
      write();
      return;
    }
    if (key === "[B" || key === "j") {
      index += 1;
      continue;
    }
    if (key === "[A" || key === "k") {
      index -= 1;
      continue;
    }
    if (key === "\t") {
      lane = lane === "claims" ? "conflicts" : "claims";
      index = 0;
      continue;
    }
    if (lane === "claims") {
      const claim = current;
      if (key === "a")
        store.review.keep(claim.id, "human");
      else if (key === "d")
        store.review.drop(claim.id, "human");
      else if (key === "p")
        store.review.pin(claim.id, "human");
      else if (key === "e") {
        write();
        const edited = await prompt(`${dim("new text:")}`);
        if (edited.trim())
          store.review.edit(claim.id, edited.trim(), "human");
      }
    } else {
      const conflict = current;
      const resolution = {
        "1": "a",
        "2": "b",
        b: "both",
        m: "merge",
        n: "dismiss"
      };
      const chosen = resolution[key];
      if (chosen)
        store.conflicts.resolve(conflict.id, chosen, "human");
    }
  }
};
var printQueue = (store) => {
  const claims = store.review.pending(200);
  const conflicts = store.conflicts.open(200);
  const now = store.now();
  write();
  write(`  ${bold("Review queue")}  ${dim(`${claims.length} claims \xB7 ${conflicts.length} conflicts`)}`);
  for (const claim of claims.slice(0, 20)) {
    write(`  ${dim(claim.id.slice(-6))}  ${bar(claim.strength, 6)}  ${dim(claim.writer.padEnd(7))} ${truncate(claim.text, 78)}`);
  }
  for (const conflict of conflicts.slice(0, 20)) {
    write(`  ${warn("\u25B2")} ${warn(conflict.kind.padEnd(22))} ${dim(ago(conflict.createdAt, now))}`);
    write(`      A  ${truncate(conflict.a.text, 76)}`);
    write(`      B  ${truncate(conflict.b.text, 76)}`);
  }
  write();
};

// packages/cli/src/index.ts
var HELP = `
${bold("ledger")} ${dim("\u2014 local memory for a fleet of agents")}

${dim("For agents")}
  ${accent("recall")} <query>            search; counts as a retrieval
  ${accent("remember")} <text>           write one memory      ${dim("--cluster required")}
  ${accent("forget")} <id...>            drop memories
  ${accent("link")} <a> <b>              record that two memories are related
  ${accent("clusters")}                  the topic taxonomy
  ${accent("conflicts")}                 pairs the store wants judged
  ${accent("judge")} <candidate>         ${dim("--verdict conflict|unrelated [--kind ...]")}
  ${accent("ingest")} <file>             store a document as searchable chunks

${dim("For you")}
  ${accent("serve")}                     the supervision UI     ${dim(`http://127.0.0.1:${DEFAULT_PORT}`)}
  ${accent("review")}                    work the queue in the terminal
  ${accent("search")} <query>            search without counting a retrieval
  ${accent("resolve")} <id> <how>        ${dim("a|b|both|merge|dismiss")}
  ${accent("sources")}                   ingested documents
  ${accent("stats")}                     what is in the store
  ${accent("export")} [query]            matching memories as JSONL

${dim("Filters")}  ${dim("agent: cluster: type: kind: strength:<40 asof: after: before:")}

${dim("Options")}
  --agent <id>       who is acting        ${dim('($LEDGER_AGENT, default "agent")')}
  --cluster <id>     cluster to write to
  --json             machine-readable output
  --limit <n>        results              ${dim("(default 10 recall, 25 search)")}
  --db <path>        store location       ${dim("($LEDGER_DB)")}
  --port <n>         serve port           ${dim(`(default ${DEFAULT_PORT})`)}

${dim("Store")}  ${dim(storePath())}
`;
var withStore = (options, run) => {
  const store = openStore({ path: options.db });
  try {
    return run(store);
  } finally {
    store.close();
  }
};
var fail = (message) => {
  process.stderr.write(`${danger("\u2715")} ${message}
`);
  process.exit(1);
};
var agentLine = (m) => `${m.id}  ${String(Math.round(m.strength * 100)).padStart(3)}  ${m.text.replace(/\s+/g, " ").trim()}${dim(`  [${m.clusterId}]`)}`;
var run = async (argv) => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      db: { type: "string" },
      agent: { type: "string" },
      cluster: { type: "string" },
      port: { type: "string" },
      host: { type: "string" },
      trust: { type: "string" },
      limit: { type: "string" },
      mode: { type: "string" },
      verdict: { type: "string" },
      kind: { type: "string" },
      detector: { type: "string" },
      note: { type: "string" },
      text: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });
  const options = {
    db: values.db ?? storePath(),
    agent: values.agent ?? defaultAgent(),
    cluster: values.cluster,
    port: values.port ? Number(values.port) : DEFAULT_PORT,
    host: values.host ?? "127.0.0.1",
    json: values.json ?? false,
    trust: values.trust ? Number(values.trust) : undefined,
    limit: values.limit ? Number(values.limit) : undefined,
    mode: values.mode,
    verdict: values.verdict,
    kind: values.kind,
    detector: values.detector ? Number(values.detector) : undefined,
    note: values.note,
    text: values.text
  };
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    write(HELP);
    return;
  }
  switch (command) {
    case "recall": {
      withStore(options, (store) => {
        const found = store.memories.search({
          query: rest.join(" "),
          agent: options.agent,
          countRead: true,
          limit: options.limit ?? 10,
          ...options.mode ? { mode: options.mode } : {}
        });
        if (found.isErr())
          fail(explain(found.error));
        const result = found._unsafeUnwrap();
        if (options.json) {
          write(JSON.stringify(result.hits, null, 2));
          return;
        }
        if (result.total === 0) {
          write("nothing remembered about that");
          return;
        }
        write(`${result.total} ${result.total === 1 ? "memory" : "memories"}${result.capped ? " (more matched than could be ranked \u2014 narrow the query)" : ""}`);
        for (const m of result.hits)
          write(agentLine(m));
      });
      return;
    }
    case "remember": {
      const text = options.text ?? rest.join(" ");
      if (!text) {
        fail('Nothing to remember. Try: ledger remember "Prefers metric units" --cluster prefs');
      }
      if (!options.cluster)
        fail("--cluster is required. Run `ledger clusters` to see the taxonomy.");
      withStore(options, (store) => {
        const written = store.memories.write({
          text,
          cluster: options.cluster ?? "",
          agent: options.agent,
          ...options.note ? { provenance: options.note } : {}
        });
        if (written.isErr())
          fail(explain(written.error));
        const m = written._unsafeUnwrap();
        if (options.json) {
          write(JSON.stringify(m, null, 2));
          return;
        }
        write(`remembered ${m.id}`);
        const waiting = store.stats().candidates;
        if (waiting > 0) {
          write(`${waiting} conflict candidate${waiting === 1 ? "" : "s"} waiting \u2014 run \`ledger conflicts\` when convenient`);
        }
      });
      return;
    }
    case "forget": {
      if (rest.length === 0)
        fail("Which memories? Try: ledger forget m_abc123");
      withStore(options, (store) => {
        const dropped = store.memories.remove(rest, options.agent);
        write(`forgot ${dropped} \u2014 still answerable by asof: queries`);
      });
      return;
    }
    case "link": {
      const [a, b] = rest;
      if (!a || !b)
        fail("Two memory ids required. Try: ledger link m_abc m_def");
      withStore(options, (store) => {
        const linked = store.memories.link(a ?? "", b ?? "", options.agent);
        if (linked.isErr())
          fail(explain(linked.error));
        write(`linked ${a} ${b}`);
      });
      return;
    }
    case "clusters": {
      withStore(options, (store) => {
        if (rest[0] === "add") {
          const label = rest.slice(1).join(" ");
          if (!label)
            fail('What should it be called? Try: ledger clusters add "Client work"');
          const created = store.clusters.create({ label });
          if (created.isErr())
            fail(explain(created.error));
          write(`${accent("\u2713")} ${created._unsafeUnwrap().id}`);
          return;
        }
        if (options.json) {
          write(JSON.stringify(store.clusters.list(), null, 2));
          return;
        }
        const counts = new Map(store.memories.facets().cluster.map((c) => [c.cluster_id, c.n]));
        for (const c of store.clusters.list()) {
          write(`${c.id.padEnd(14)} ${dim(c.label.padEnd(20))} ${dim(String(counts.get(c.id) ?? 0))}`);
        }
      });
      return;
    }
    case "conflicts": {
      withStore(options, (store) => {
        const candidates = store.conflicts.candidates(options.limit ?? 5);
        if (options.json) {
          write(JSON.stringify(candidates, null, 2));
          return;
        }
        if (candidates.length === 0) {
          write("nothing to judge");
          return;
        }
        for (const c of candidates) {
          write("");
          write(`${c.id}  ${dim(c.signals.join(", "))}`);
          write(`  A  ${c.a.id}  ${c.a.text}`);
          write(`  B  ${c.b.id}  ${c.b.text}`);
        }
        write("");
        write("For each pair: can both be true at once?");
        write('  no  \u2192 ledger judge <id> --verdict conflict --kind "<kind>" --detector 0.0-1.0');
        write("  yes \u2192 ledger judge <id> --verdict unrelated    (settles the pair for good)");
      });
      return;
    }
    case "judge": {
      const candidateId = rest[0];
      if (!candidateId)
        fail("Which candidate? Run `ledger conflicts` to list them.");
      if (options.verdict !== "conflict" && options.verdict !== "unrelated") {
        fail('--verdict must be "conflict" or "unrelated"');
      }
      withStore(options, (store) => {
        const judged = store.conflicts.judge({
          candidateId: candidateId ?? "",
          agent: options.agent,
          verdict: options.verdict === "conflict" ? "conflict" : "unrelated",
          ...options.kind ? { kind: options.kind } : {},
          ...options.detector !== undefined ? { detector: options.detector } : {},
          ...options.note ? { note: options.note } : {}
        });
        if (judged.isErr())
          fail(explain(judged.error));
        const conflict = judged._unsafeUnwrap();
        write(conflict === null ? "settled \u2014 marked unrelated, will not be proposed again" : `queued ${conflict.id} \u2014 ${conflict.kind}, for the human to resolve`);
      });
      return;
    }
    case "ingest": {
      const path = rest[0];
      if (!options.cluster)
        fail("--cluster is required.");
      let filename = path ?? "stdin";
      let text = options.text;
      let bytes;
      if (text === undefined) {
        if (!path)
          fail("Which file? Try: ledger ingest notes.md --cluster reading");
        if (path === "-") {
          text = await Bun.stdin.text();
          filename = "stdin";
        } else {
          const read = await readSourceFile(path ?? "");
          if (read.isErr())
            fail(explain(read.error));
          const source = read._unsafeUnwrap();
          filename = source.filename;
          text = source.text;
          bytes = source.bytes;
        }
      }
      withStore(options, (store) => {
        const ingested = store.sources.ingest({
          filename,
          cluster: options.cluster ?? "",
          agent: options.agent,
          text: text ?? "",
          ...bytes !== undefined ? { bytes } : {},
          ...options.trust !== undefined ? { trust: options.trust } : {}
        });
        if (ingested.isErr())
          fail(explain(ingested.error));
        const { source, chunks } = ingested._unsafeUnwrap();
        if (options.json) {
          write(JSON.stringify({ sourceId: source.id, chunks }, null, 2));
          return;
        }
        write(`ingested ${source.id}  ${chunks} chunks`);
        write("Chunks are searchable now and are never reviewed one by one. If the document");
        write("asserts something worth remembering on its own, `ledger remember` it as a claim");
        write("\u2014 that becomes a reviewable memory.");
      });
      return;
    }
    case "serve": {
      const ui = await findUi();
      const server = createServer({
        store: { path: options.db },
        port: options.port,
        host: options.host,
        ...ui ? { ui } : {}
      });
      const running = server.listen();
      const stats = server.store.stats();
      write();
      write(`  ${accent("\u25CF")} ${bold("LEDGER")} ${dim("running")}   ${muted(running.url)}`);
      write(`  ${dim(`${stats.memories} memories \xB7 ${stats.pending} pending review \xB7 ${options.db}`)}`);
      if (!ui)
        write(`  ${dim("ui   not bundled \u2014 run `bun run build:skill` in the workspace")}`);
      write();
      write(`  ${dim("Bound to loopback. Nothing in this store leaves this machine.")}`);
      write();
      const stop = () => {
        running.stop().then(() => process.exit(0));
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
      await new Promise(() => {});
      return;
    }
    case "review": {
      const store = openStore({ path: options.db });
      try {
        if (options.json || !process.stdin.isTTY)
          printQueue(store);
        else
          await runReview(store);
      } finally {
        store.close();
      }
      return;
    }
    case "search": {
      withStore(options, (store) => {
        const found = store.memories.search({
          query: rest.join(" "),
          limit: options.limit ?? 25,
          countRead: false,
          ...options.mode ? { mode: options.mode } : {}
        });
        if (found.isErr())
          fail(explain(found.error));
        const result = found._unsafeUnwrap();
        if (options.json) {
          write(JSON.stringify(result.hits, null, 2));
          return;
        }
        heading(`${result.total} ${result.total === 1 ? "memory" : "memories"}`, `${Math.round(result.tookMs)}ms${result.capped ? " \xB7 more matched than could be ranked" : ""}`);
        const now = store.now();
        for (const m of result.hits) {
          write(`  ${dim(m.id.slice(-6))}  ${bar(m.strength, 6)} ${dim(String(Math.round(m.strength * 100)).padStart(3))}  ${dim(m.writer.padEnd(7))} ${truncate(m.text, 70).padEnd(70)} ${dim(m.clusterLabel.padEnd(16))} ${dim(ago(m.lastReadAt, now))}`);
        }
        write();
      });
      return;
    }
    case "resolve": {
      const [conflictId, resolution] = rest;
      if (!conflictId || !resolution) {
        fail("Try: ledger resolve <conflictId> a|b|both|merge|dismiss");
      }
      withStore(options, (store) => {
        const resolved = store.conflicts.resolve(conflictId ?? "", resolution, "human");
        if (resolved.isErr())
          fail(explain(resolved.error));
        write(`${accent("resolved")} ${conflictId} \u2014 ${resolution}`);
      });
      return;
    }
    case "sources": {
      withStore(options, (store) => {
        const list = store.sources.list();
        if (options.json) {
          write(JSON.stringify(list, null, 2));
          return;
        }
        heading("Sources", `${list.length} documents`);
        for (const s of list) {
          write(`  ${dim(s.ext.toUpperCase().padEnd(5))} ${bold(truncate(s.filename, 40).padEnd(40))} ${bar(s.trust, 6)} ${dim(`${s.chunkCount} chunks \xB7 ${s.claimCount} claims \xB7 ${s.hits} reads`)}`);
        }
        write();
      });
      return;
    }
    case "stats": {
      withStore(options, (store) => {
        const s = store.stats();
        if (options.json) {
          write(JSON.stringify(s, null, 2));
          return;
        }
        heading("LEDGER", options.db);
        write(`  ${bold(String(s.memories).padStart(6))}  memories   ${dim(`${s.claims} claims \xB7 ${s.chunks} chunks`)}`);
        write(`  ${bold(String(s.pending).padStart(6))}  pending review`);
        write(`  ${bold(String(s.conflicts).padStart(6))}  open conflicts   ${dim(`${s.candidates} candidates awaiting an agent`)}`);
        write(`  ${bold(String(s.sources).padStart(6))}  sources`);
        write(`  ${bold(String(s.agents).padStart(6))}  agents     ${dim(`${s.requestsToday} calls today`)}`);
        write(`  ${dim(`${(s.diskBytes / 1e6).toFixed(1)} MB on disk`)}`);
        write();
      });
      return;
    }
    case "export": {
      withStore(options, (store) => {
        const found = store.memories.search({
          query: rest.join(" "),
          limit: 1e5,
          countRead: false
        });
        if (found.isErr())
          fail(explain(found.error));
        for (const m of found._unsafeUnwrap().hits)
          write(JSON.stringify(m));
      });
      return;
    }
    default:
      fail(`Unknown command "${command}". Run \`ledger --help\`.`);
  }
};

// packages/cli/src/bin.ts
await run(process.argv.slice(2));
