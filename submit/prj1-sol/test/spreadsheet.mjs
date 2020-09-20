import AppError from '../src/app-error.mjs';
import Spreadsheet from '../src/spreadsheet.mjs';

import chai from 'chai';
const { assert } = chai;

describe('spreadsheet', function() {

  let spreadsheet;

  beforeEach(async () => spreadsheet = await Spreadsheet.make());

  it ('must evaluate a single number formula', async function () {
    const results = await spreadsheet.eval('a1', '22');
    assert.deepEqual(results, { a1: 22 });
  });

  it ('must evaluate a purely numeric formula', async function () {
    const results = await spreadsheet.eval('a1', '(1 + 2)*-3 + 4');
    assert.deepEqual(results, { a1: -5 });
  });

  it ('must evaluate a formula with a single reference', async function () {
    await spreadsheet.eval('a1', '22');
    const results = await spreadsheet.eval('a2', 'a1');
    assert.deepEqual(results, { a2: 22 });
  });

  it ('must evaluate a reference formula', async function () {
    await spreadsheet.eval('a1', '22');
    const results = await spreadsheet.eval('a2', 'a1 * a1 + a1');
    assert.deepEqual(results, { a2: 22*22 + 22 });
  });

  it ('must evaluate an undefined cell as 0', async function () {
    await spreadsheet.eval('a1', '22');
    const results = await spreadsheet.eval('a2', 'a1 * b1');
    assert.deepEqual(results, { a2: 0 });
  });

  it ('must cascade an update', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a2', 'a1 * b1');
    const results = await spreadsheet.eval('b1', '3');
    assert.deepEqual(results, { b1: 3, a2: 66,  });
  });

  it ('must evaluate a multi-level formula', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a2', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    const results = await spreadsheet.eval('a3', 'a1 + a2');
    assert.deepEqual(results, { a3: 88,  });
  });

  it ('must cascade an update through multiple levels', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a2', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a3', 'a1 + a2');
    const results = await spreadsheet.eval('a1', '3');
    assert.deepEqual(results, { a1: 3, a2: 9, a3: 12,   });
  });

  it ('must detect a syntax error', function() {
    return spreadsheet.eval('a1', 'a1 ++ 1').
      then(v => assert.fail(`expected SYNTAX error but got result ${v}`)).
      catch(err => {
	assert.equal(err.code, 'SYNTAX');
      });
  });
  
  it ('must detect a direct circular reference', function() {
    return spreadsheet.eval('a1', 'a1 + 1').
      then(v => assert.fail(`expected CIRCULAR_REF error but got result ${v}`)).
      catch(err => {
	assert.equal(err.code, 'CIRCULAR_REF');
      });
  });
  
  it ('must detect an indirect circular reference', async function() {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a2', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a3', 'a1 + a2');
    return spreadsheet.eval('a1', 'a3 + 1').
      then(v => assert.fail(`expected CIRCULAR_REF error but got result ${v}`)).
      catch(err => {
	assert.equal(err.code, 'CIRCULAR_REF');
      });
  });

  it ('must recover from an error', async function() {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a2', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a3', 'a1 + a2');
    try { await spreadsheet.eval('a1', 'a3 + 1') } catch (e) { }
    const results = await spreadsheet.eval('a4', 'a1 + a3');
    assert.deepEqual(results, { a4: 110,  });
  });

});	
