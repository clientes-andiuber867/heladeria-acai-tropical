import assert from "node:assert/strict";
import { createReadTransport } from "../src/lib/requestSharing.ts";
const url = "https://test.supabase.co/rest/v1/products";
let calls = 0;
const resolvers = [];
const fetcher = async () => {
  calls++;
  return new Promise((resolve) =>
    resolvers.push(() =>
      resolve(
        new Response(JSON.stringify({ version: calls }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    ),
  );
};
const read = createReadTransport(fetcher);
const config = (branch = "one", token = "admin") => ({
  headers: { "x-branch-id": branch, Authorization: `Bearer ${token}` },
});
const a = read(url, config()),
  b = read(url, config());
assert.equal(calls, 1);
resolvers.shift()();
assert.deepEqual(await (await a).json(), await (await b).json());
const c = read(url, config()),
  d = read(url, config("two")),
  e = read(url, config("one", "cashier"));
assert.equal(calls, 4);
while (resolvers.length) resolvers.shift()();
await Promise.all([c, d, e]);
// A completed read is not a cache: the next request always checks the server.
const f = read(url, config());
assert.equal(calls, 5);
const mutation = read(url, { ...config(), method: "PATCH", body: "{}" });
const after = read(url, config());
assert.equal(calls, 7);
while (resolvers.length) resolvers.shift()();
await Promise.all([f, mutation, after]);
const write1 = read(url, { ...config(), method: "POST", body: "{}" }),
  write2 = read(url, { ...config(), method: "POST", body: "{}" });
assert.equal(calls, 9);
while (resolvers.length) resolvers.shift()();
await Promise.all([write1, write2]);
const controller = new AbortController();
const abortable = read(url, { ...config(), signal: controller.signal }),
  separate = read(url, config());
assert.equal(calls, 11);
while (resolvers.length) resolvers.shift()();
await Promise.all([abortable, separate]);
console.log(
  "PASS: concurrent reads shared; tokens, branches, mutations and abort signals isolated; no stale response cache.",
);
