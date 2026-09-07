import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLicense, parseLicenseField, classifyDependency } from '../licenseClassifier';

test('classifyLicense recognizes common permissive licenses', () => {
  assert.equal(classifyLicense('MIT'), 'permissive');
  assert.equal(classifyLicense('Apache-2.0'), 'permissive');
  assert.equal(classifyLicense('ISC'), 'permissive');
});

test('classifyLicense recognizes weak copyleft', () => {
  assert.equal(classifyLicense('LGPL-3.0'), 'weak-copyleft');
  assert.equal(classifyLicense('MPL-2.0'), 'weak-copyleft');
});

test('classifyLicense recognizes strong copyleft', () => {
  assert.equal(classifyLicense('GPL-3.0'), 'strong-copyleft');
  assert.equal(classifyLicense('AGPL-3.0'), 'strong-copyleft');
});

test('classifyLicense strips -only/-or-later SPDX suffixes', () => {
  assert.equal(classifyLicense('GPL-3.0-only'), 'strong-copyleft');
  assert.equal(classifyLicense('LGPL-2.1-or-later'), 'weak-copyleft');
});

test('classifyLicense returns unknown for an unrecognized id', () => {
  assert.equal(classifyLicense('SomeMadeUpLicense-1.0'), 'unknown');
});

test('parseLicenseField reads a plain SPDX string', () => {
  assert.deepEqual(parseLicenseField({ license: 'MIT' }), ['MIT']);
});

test('parseLicenseField reads the older { type, url } object form', () => {
  assert.deepEqual(parseLicenseField({ license: { type: 'BSD-3-Clause', url: 'https://...' } }), ['BSD-3-Clause']);
});

test('parseLicenseField reads the deprecated licenses[] array form', () => {
  const pkg = { licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] };
  assert.deepEqual(parseLicenseField(pkg), ['MIT', 'Apache-2.0']);
});

test('parseLicenseField splits an SPDX OR expression', () => {
  assert.deepEqual(parseLicenseField({ license: '(MIT OR Apache-2.0)' }), ['MIT', 'Apache-2.0']);
});

test('parseLicenseField returns empty for a package with no license field', () => {
  assert.deepEqual(parseLicenseField({ name: 'x' }), []);
});

test('classifyDependency reports unknown when no license field exists', () => {
  const result = classifyDependency('some-pkg', { name: 'some-pkg' });
  assert.equal(result.category, 'unknown');
});

test('classifyDependency reports the worst category among a dual license', () => {
  const result = classifyDependency('some-pkg', { license: '(MIT OR GPL-3.0)' });
  assert.equal(result.category, 'strong-copyleft');
});

test('classifyDependency reports permissive for a plain MIT package', () => {
  const result = classifyDependency('some-pkg', { license: 'MIT' });
  assert.equal(result.category, 'permissive');
});
