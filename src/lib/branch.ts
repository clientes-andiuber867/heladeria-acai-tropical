import { createReadTransport, isReadRequest } from "./requestSharing";
const transport = createReadTransport(fetch);
export const FIRST_BRANCH = "00000000-0000-4000-8000-000000000001";
export type Branch = { id: string; name: string; order_phone: string };
let selected =
  new URLSearchParams(location.search).get("sucursal") || FIRST_BRANCH;
let label = "Açaí Tropical 1";
let requests = 0;
let operations = 0;
export function holdBranch() {
  operations++;
  return () => {
    operations--;
  };
}
export const branchId = () => selected;
export const branchName = () => label;
export const branchRequestsPending = () => requests > 0 || operations > 0;
export function setActiveBranch(branch: Branch) {
  selected = branch.id;
  label = branch.name;
}
export const menuPath = (id = selected) =>
  `/menu?sucursal=${encodeURIComponent(id)}`;
// Snapshot the branch at dispatch, never read a mutable setting on the server.
export async function branchFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  headers.set("x-branch-id", selected);
  const writing = !isReadRequest(input, init);
  if (writing) requests++;
  try {
    return await transport(input, { ...init, headers });
  } finally {
    if (writing) requests--;
  }
}
