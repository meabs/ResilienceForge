import assert from 'node:assert/strict';
import test from 'node:test';
import { waitUntilCatalogMatches } from './webmcp.ts';

test('catalog wait resolves only after every expected tool name is listed', async () => {
  let listed: Array<{ name: string }> = [];
  const pending = waitUntilCatalogMatches(
    ['get_webmcp_status', 'fail_component', 'get_bench_snapshot'],
    async () => listed,
    { timeoutMs: 400, pollMs: 10 },
  );
  listed = [{ name: 'get_webmcp_status' }];
  await new Promise((resolve) => setTimeout(resolve, 30));
  listed = [
    { name: 'get_webmcp_status' },
    { name: 'fail_component' },
    { name: 'get_bench_snapshot' },
    { name: 'extra' },
  ];
  const result = await pending;
  assert.equal(result.matched, true);
  assert.deepEqual(result.names.slice(0, 3), ['get_webmcp_status', 'fail_component', 'get_bench_snapshot']);
});

test('catalog wait can finish from a toolchange-style subscription without waiting for timeout', async () => {
  let listed: Array<{ name: string }> = [];
  let notify = () => undefined;
  const pending = waitUntilCatalogMatches(
    ['alpha', 'beta'],
    async () => listed,
    {
      timeoutMs: 1000,
      pollMs: 1000,
      subscribe: (onChange) => {
        notify = onChange;
        return () => undefined;
      },
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  listed = [{ name: 'alpha' }, { name: 'beta' }];
  notify();
  const result = await pending;
  assert.equal(result.matched, true);
});
