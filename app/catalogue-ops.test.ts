import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueCards, loadArchitectureHref, resolveCatalogueSelection, routeFromPath } from './catalogue-ops.ts';

test('catalogue lists the three equal references', () => {
  const cards = catalogueCards();
  assert.deepEqual(cards.map((card) => card.id), [
    'event_driven_checkout',
    'multi_region_saas',
    'llm_inference_serving',
  ]);
  assert.equal(loadArchitectureHref('event_driven_checkout'), '/bench/event_driven_checkout');
});

test('catalogue selection accepts ids, names, and short aliases', () => {
  assert.equal(resolveCatalogueSelection('event_driven_checkout')?.id, 'event_driven_checkout');
  assert.equal(resolveCatalogueSelection('checkout')?.id, 'event_driven_checkout');
  assert.equal(resolveCatalogueSelection('Event-driven checkout')?.id, 'event_driven_checkout');
  assert.equal(resolveCatalogueSelection('saas')?.id, 'multi_region_saas');
  assert.equal(resolveCatalogueSelection('llm')?.id, 'llm_inference_serving');
});

test('unknown catalogue selection does not fall back to checkout', () => {
  assert.equal(resolveCatalogueSelection('does_not_exist'), undefined);
  assert.equal(resolveCatalogueSelection(''), undefined);
  assert.equal(resolveCatalogueSelection(undefined), undefined);
});

test('site routes distinguish catalogue from a loaded bench', () => {
  assert.deepEqual(routeFromPath('/'), { view: 'catalogue' });
  assert.deepEqual(routeFromPath('/bench/event_driven_checkout'), { view: 'bench', architectureId: 'event_driven_checkout' });
  assert.deepEqual(routeFromPath('/bench/does_not_exist'), { view: 'bench', architectureId: 'does_not_exist' });
});
