import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseOutcome } from './product-outcome.mjs';

const REPO = 'bloom-marketing-co/demo';
const body = (outcome, relationship) => `## Why\n\nBecause.\n\n## Product outcome\n\n<!-- Required: CI reads these two lines. -->\n\n- Outcome issue: ${outcome}\n- Relationship: ${relationship}\n\n## Links\n\n- Outcome issue: #999\n`;

test('the shipped template fails until both lines are filled in', () => {
  const template = readFileSync(new URL('../../pull_request_template.md', import.meta.url), 'utf8');
  const result = parseOutcome(template, REPO);
  assert.equal(result.errors.length, 2);
});
test('accepts same-repo numbers, org issue URLs and Not applicable', () => {
  assert.deepEqual(parseOutcome(body('#12', 'Advances'), REPO), { errors: [], issue: { repo: REPO, number: 12 } });
  assert.deepEqual(parseOutcome(body('https://github.com/bloom-marketing-co/Venue-Platform/issues/7', 'Implements'), REPO).issue, { repo: 'bloom-marketing-co/Venue-Platform', number: 7 });
  assert.deepEqual(parseOutcome(body('https://github.com/c-o-l-3/Venue-Platform/issues/7', 'verification only'), REPO).errors, []);
  assert.deepEqual(parseOutcome(body('Not applicable', 'Not applicable'), REPO), { errors: [], issue: null });
});
test('rejects missing section, placeholders, other owners and pull request URLs', () => {
  assert.match(parseOutcome('## Why\n\nNo section.', REPO).errors[0], /no "## Product outcome" section/);
  assert.equal(parseOutcome(body('', ''), REPO).errors.length, 2);
  assert.equal(parseOutcome(body('https://github.com/someone-else/x/issues/1', 'Advances'), REPO).errors.length, 1);
  assert.equal(parseOutcome(body('https://github.com/bloom-marketing-co/x/pull/1', 'Advances'), REPO).errors.length, 1);
  assert.equal(parseOutcome(body('#12', 'Fixes'), REPO).errors.length, 1);
});
test('Not applicable must be used on both lines or neither', () => {
  assert.equal(parseOutcome(body('Not applicable', 'Advances'), REPO).errors.length, 1);
  assert.equal(parseOutcome(body('#3', 'Not applicable'), REPO).errors.length, 1);
});
test('lines outside the section and inside comments are ignored', () => {
  const commented = '## Product outcome\n\n<!-- - Outcome issue: #1\n- Relationship: Advances -->\n- Outcome issue:\n- Relationship:\n';
  assert.equal(parseOutcome(commented, REPO).errors.length, 2);
});
