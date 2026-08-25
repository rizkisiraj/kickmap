// Reads the `X-Test-Run` header k6 sends on every request (load-test.js,
// stress-test.js, capacity-test.js — Part 4 of the load-testing plan), for
// correlating a route's completion logs with a specific k6 run in Grafana's
// `test_run` dashboard variable.
//
// Returns undefined (never an empty string) on normal traffic, so routes can
// spread the result into their log object without emitting a `testRun: ""`
// field on every non-load-test request — cardinality in Loki is bounded by
// the number of load-test runs, not by every request.
export const getTestRun = (request: Request): string | undefined => {
  const header = request.headers.get('x-test-run');
  if (!header) return undefined;
  const trimmed = header.trim();
  return trimmed ? trimmed : undefined;
};
