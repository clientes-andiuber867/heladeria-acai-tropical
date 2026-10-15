const readRPCs = new Set([
  "dashboard_summary",
  "sales_collection_totals",
  "product_sales_ranking",
  "search_audit",
  "cash_shift_balance",
  "inventory_snapshot",
  "public_payment_qr",
]);
export function isReadRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = (
    init?.method || (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const path = new URL(input instanceof Request ? input.url : String(input))
    .pathname;
  return (
    ["GET", "HEAD"].includes(method) ||
    (path.includes("/rest/v1/rpc/") && readRPCs.has(path.split("/").pop()!))
  );
}

/** Share only concurrent REST reads. Never cache results or share across tokens,
 * branches, filters or abort signals. Mutations invalidate outstanding reads. */
export function createReadTransport(fetcher: typeof fetch) {
  const pending = new Map<string, Promise<Response>>();
  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const read = isReadRequest(input, init);
    if (!read) pending.clear();
    const url = input instanceof Request ? input.url : String(input);
    const share =
      read &&
      url.includes("/rest/v1/") &&
      !init?.signal &&
      !(input instanceof Request);
    const key = JSON.stringify([
      url,
      init?.method || "GET",
      [...new Headers(init?.headers).entries()].sort(),
      init?.body || "",
    ]);
    let task = share ? pending.get(key) : undefined;
    if (!task) {
      task = (async () => {
        try {
          // Preserve the native response, including bodyless HTTP statuses.
          // Browsers may expose a stream for 204 even though constructing a
          // Response with that status and any body (even zero bytes) is invalid.
          return await fetcher(input, init);
        } finally {
          if (!read) pending.clear();
        }
      })();
      if (share) {
        pending.set(key, task);
        const clear = () => {
          if (pending.get(key) === task) pending.delete(key);
        };
        void task.then(clear, clear);
      }
    }
    const response = await task;
    return share ? response.clone() : response;
  };
}
