import { AppError, Spreadsheet } from 'cs544-ss';
import SSClient from '../src/ss-client.mjs';

import chai from 'chai';
const { assert } = chai;

const URL = 'http://localhost:2345';
const SS_NAME = 'ss';

describe.only('web-spreadsheet', function() {

  let store, spreadsheet
  
  const init = async () => {
    [spreadsheet, store] = await makeWebSpreadsheet();
    await spreadsheet.clear();
  };

  beforeEach(async () => await init());

  it ('must query a single number formula', async function () {
    await spreadsheet.eval('a1', '22');
    const results = await spreadsheet.query('a1');
    assert.deepEqual(results, { formula: '22', value: 22 });
  });

  it ('must query a purely numeric formula', async function () {
    await spreadsheet.eval('a1', '(1 + 2)*3 - 4');
    const results = await spreadsheet.query('a1');
    assert.deepEqual(results, { formula: '(1+2)*3-4', value: 5 });
  });

  it ('must query an empty cell as 0 with empty formula', async function () {
    const results = await spreadsheet.query('a1');
    assert.deepEqual(results, { value: 0, formula: '' });
  });

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

  it ('must evaluate an empty cell as 0', async function () {
    await spreadsheet.eval('a1', '22');
    const results = await spreadsheet.eval('a2', '2*a1 + b1');
    assert.deepEqual(results, { a2: 44 });
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

  it ('must detect a syntax error', async function() {
    //can't figure out how to assert.throws() for async fn
    //const fn = async () => await spreadsheet.eval('a1', '- + 1');
    //assert.throws(fn, /SYNTAX/);
    try {
      const v = JSON.stringify(await spreadsheet.eval('a1', '- + 1'));
      assert.fail(`expected SYNTAX error but got result ${v}`);
    }
    catch(err) {
      if (!(err instanceof AppError)) assert.fail(err.message);
      assert.equal(err.code, 'SYNTAX');
    }
  });
  
  it ('must detect a direct circular reference', async function() {
    try {
      const v = JSON.stringify(await spreadsheet.eval('a1', 'a1 + 1'));
      assert.fail(`expected CIRCULAR_REF error but got result ${v}`);
    }
    catch(err) {
      if (!(err instanceof AppError)) assert.fail(err.message);
      assert.equal(err.code, 'CIRCULAR_REF');
    }
  });

  it ('must detect an indirect circular reference', async function() {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a2', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a3', 'b1 + a2');
    try {
      const v = JSON.stringify(await spreadsheet.eval('a1', 'a3 + 1'));
      assert.fail(`expected CIRCULAR_REF error but got result ${v}`);
    }
    catch(err) {
      if (!(err instanceof AppError)) assert.fail(err.message);
      assert.equal(err.code, 'CIRCULAR_REF');
    }
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

  it ('must copy formula with relative references', async function() {
    const ss = spreadsheet;
    //c2: 2, d2: 4, e2: 6, f2: (c2 + d2)*e2
    const data = await addData(ss, 4, 'c2', () => 0, () => 1,
			       i => (i < 3) ? String((i+1)*2) : '(c2 + d2)*e2');
    assert.equal((await ss.query('f2')).value, 36);
    //e4: 3, f4: 6, g4: 9, h4: 12, i4: h4*2
    await addData(ss, 5, 'e4', () => 0, () => 1,
		  i => (i < 4) ? String((i + 1)*3) : 'h4*2');
    assert.equal((await ss.query('i4')).value, 24);
    const results = await ss.copy('h4', 'f2'); //h4 = (e4 + f4)*g4
    assert.deepEqual(results, { h4: 81, i4: 162 });
  });

  it ('must copy formula with relative/absolute references', async function() {
    const ss = spreadsheet;
    //c2: 2, d2: 4, e2: 6, f2: (c2 + d2)*$e$2
    const formula = '(c2 + d2)*$e$2';
    const data = await addData(ss, 4, 'c2', () => 0, () => 1,
			       i => (i < 3) ? String((i+1)*2) : formula);
    assert.equal((await ss.query('f2')).value, 36);
    //e4: 3, f4: 6, g4: 9, h4: 12, i4: h4*2
    await addData(ss, 5, 'e4', () => 0, () => 1,
		  i => (i < 4) ? String((i + 1)*3) : 'h4*2');
    assert.equal((await ss.query('i4')).value, 24);
    const results = await ss.copy('h4', 'f2'); //h4 = (e4 + f4)*$e$2
    assert.deepEqual(results, { h4: 54, i4: 108 });
  });

  it ('must detect circular references when copying', async function() {
    const ss = spreadsheet;
    try {
      await ss.eval('d2', '42');
      await ss.eval('c1', '$d$2 + 1'); //43
      await ss.eval('c2', 'c1*2');     //86
      await ss.eval('c3', 'c2 + 1');   //87
      assert.equal((await ss.query('c3')).value, 87);
      await ss.copy('d1', 'c1');
      const v = await JSON.stringify(await ss.copy('d2', 'c3'));  //circular ref
      assert.fail(`expected CIRCULAR_REF error but got result ${v}`);
    }
    catch (err) {
      if (!(err instanceof AppError)) assert.fail(err.message);
      assert.equal(err.code, 'CIRCULAR_REF');
    }
  });

  it ('must cascade copy of an empty cell', async function() {
    const ss = spreadsheet;
    //c3: 42, c4: 44, c5: 46, c6: 48, c7: 50
    const data =
      await addData(ss, 5, 'c3', () => 1, () => 0, 
		    (i, x) => (i === 0) ? '42' : `${x[i-1].relRel}+2`);
    assert.equal((await ss.query('c7')).value, 50);
    const results = await ss.copy('c3', 'x4');
    assert.deepEqual(results, { 'c4': 2, 'c5': 4, 'c6': 6, 'c7': 8 });
  });

  it ('must clear spreadsheet', async function() {
    const ss = spreadsheet;
    const data = await addData(ss, 10);
    await ss.clear();
    const dataPromises =
      Object.keys(data).map(async c => [c, (await ss.query(c)).formula]);
    const results = Object.fromEntries(await Promise.all(dataPromises));
    const expected = Object.fromEntries(Object.keys(data).map(k => [k, '']));
    assert.deepEqual(results, expected);
  });

  it ('must delete cells', async function() {
    const ss = spreadsheet;
    const data = await addData(ss, 10);
    for (const k of Object.keys(data)) { await ss.delete(k); }
    const dataPromises =
      Object.keys(data).map(async c => [c, (await ss.query(c)).formula]);
    const results = Object.fromEntries(await Promise.all(dataPromises));
    const expected = Object.fromEntries(Object.keys(data).map(k => [k, '']));
    assert.deepEqual(results, expected);
  });

  it ('must delete cell from an empty spreadsheet', async function() {
    const ss = spreadsheet;
    const results = await ss.delete('a1');
    assert.deepEqual(results, {});
  });

  
  it ('must delete empty cells', async function() {
    const ss = spreadsheet;
    const data = await addData(ss, 10, 'b1');
    await ss.delete('a1'); await ss.delete('a10');
    const dataPromises =
      Object.keys(data).map(async c => [c, (await ss.query(c)).formula]);
    const results = Object.fromEntries(await Promise.all(dataPromises));
    assert.deepEqual(results, data);
  });

  

  it ('must delete cells with cascade', async function() {
    const ss = spreadsheet;
    //c3: 42, c4: 44, c5: 46, c6: 48, c7: 50
    const data =
      await addData(ss, 5, 'c3', () => 1, () => 0, 
		    (i, x) => (i === 0) ? '42' : `${x[i-1].relRel}+2`);
    assert.equal((await ss.query('c7')).value, 50);
    const results = await ss.delete('c3');
    assert.deepEqual(results, { 'c4': 2, 'c5': 4, 'c6': 6, 'c7': 8 });
  });

  it ('must dump empty spreadsheet', async function() {
    const ss = spreadsheet;
    const results = await ss.dump();
    assert.deepEqual(results, []);
  });

  it ('must dump spreadsheet in lexical order', async function() {
    const ss = spreadsheet;
    const data = await addData(ss, 10);
    const results = await ss.dump();
    assert.deepEqual(results, Object.entries(data));
  });

  it ('must dump spreadsheet in topological/lexical order', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a3', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a2', 'a1 + a3');
    const results = await spreadsheet.dump();
    assert.deepEqual(results, [
      [ 'a1', '22' ], [ 'b1', '3' ],
      [ 'a3', 'a1*b1' ],
      [ 'a2', 'a1+a3' ],
    ]);
  });

  /** Persistence tests */
  it ('must persist constant formulas', async function() {
    const ss = spreadsheet;
    const data = await addData(ss, 10);
    const expected = await ss.dump();
    const results = await getNewInstanceDump();
    assert.deepEqual(results, expected);
  });

  it ('must persist complex formulas', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a3', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a2', 'a1 + a3');
    await spreadsheet.eval('a4', '(a2 + a3)*4 - (-3 * a3 + b1/2)');
    const expected = await spreadsheet.dump();
    const results = await getNewInstanceDump();
    assert.deepEqual(results, expected);
  });

  it ('must persist copy operations', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a3', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a2', 'a1 + a3');
    await spreadsheet.eval('a4', '(a2 + $a3)*4 - (-3 * a$3 + $b$1/2)');
    await spreadsheet.copy('c7', 'a4');
    await spreadsheet.copy('c10', 'a2');
    await spreadsheet.copy('a3', 'a11');  //erase a3
    await spreadsheet.copy('a10', 'a11'); //erase non-existing cell
    const expected = await spreadsheet.dump();
    const results = await getNewInstanceDump();
    assert.deepEqual(results, expected);
  });

  it ('must persist delete operations', async function () {
    await spreadsheet.eval('a1', '22');
    await spreadsheet.eval('a3', 'a1 * b1');
    await spreadsheet.eval('b1', '3');
    await spreadsheet.eval('a2', 'a1 + a3');
    await spreadsheet.eval('a4', '(a2 + $a3)*4 - (-3 * a$3 + $b$1/2)');
    await spreadsheet.delete('b1');
    await spreadsheet.delete('a4');
    await spreadsheet.delete('a9'); //delete empty cell
    const expected = await spreadsheet.dump();
    const results = await getNewInstanceDump();
    assert.deepEqual(results, expected);
  });

  it ('must load an empty spreadsheet', async function () {
    const expected = await spreadsheet.dump();
    const results = await getNewInstanceDump();
    assert.deepEqual(results, expected);
  });

  
});	

async function makeWebSpreadsheet() {
  const store = await SSClient.make(URL);
  const ss = await Spreadsheet.make(SS_NAME, store);
  return [ss, store];
}

async function getNewInstanceDump() {
  const [ss, store] = await makeWebSpreadsheet();
  const results = await ss.dump();
  return results;
}


/** Add nData formulas to spreadsheet ss starting at cell startCellId.
 *  Successive cells are computed by incrmenting row / col id's by
 *  rowIncFn() / colIncFn(). Formula for a cell is the result of
 *  calling formulaFn().  All functions are called passing in the
 *  index in [0, nData) and a map of previously determined cells.
 *
 *  Returns map from cell-ids to formulas.
 */
async function addData(ss, nData,
		       startCellId= "a1",
		       rowIncFn = () => 1,
		       colIncFn = () => 1,
		       formulaFn = i => String(i + 2))
{
  console.assert(nData < 26);
  const data = {};
  console.assert(/^[a-zA-Z]\d+$/.test(startCellId));
  const a = 'a'.codePointAt(0);
  let colIndex = startCellId[0].toLowerCase().codePointAt(0) - a;
  let rowIndex = Number(startCellId.slice(1)) - 1;
  const cellInfos = [];
  for (let i = 0; i < nData; i++) {
    const r = String(1 + rowIndex);
    const c = String.fromCodePoint(a + colIndex);
    const cellId = `${c}${r}`;
    const formula = formulaFn(i, cellInfos);
    rowIndex += rowIncFn(i, cellInfos);
    colIndex += colIncFn(i, cellInfos);
    cellInfos.push({
      relRel: cellId,
      relAbs: `${c}$${r}`,
      absRel: `$${c}${r}`,
      absAbs: `$${c}$${r}`,
      formula,
    });
    data[cellId] = formula;
  }
  for (const [k, v] of Object.entries(data)) { await ss.eval(k, v); }
  return data;
}

