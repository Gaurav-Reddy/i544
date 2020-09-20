import { scan, CellRef } from '../src/expr-parser.mjs';

import chai from 'chai';
const { assert } = chai;

describe('scan', function() {

  it ('an integer should scan correctly', function () {
    const tokens = scan(' 123 ');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'num');
    assert.equal(tokens[0].lexeme, '123');
    assert.equal(tokens[0].value, 123);
  });

  it ('a number with decimal point should scan correctly', function () {
    const tokens = scan(' 1.23 ');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'num');
    assert.equal(tokens[0].lexeme, '1.23');
    assert.equal(tokens[0].value, 1.23);
  });

  it ('a number with exponent should scan correctly', function () {
    const tokens = scan(' 1.23e2 ');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'num');
    assert.equal(tokens[0].lexeme, '1.23e2');
    assert.equal(tokens[0].value, 123);
  });

  it ('a number with negative exponent should scan correctly', function () {
    const tokens = scan(' 123e-2 ');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'num');
    assert.equal(tokens[0].lexeme, '123e-2');
    assert.equal(tokens[0].value, 1.23);
  });

  it ('a rel/rel ref should scan correctly', function () {
    const tokens = scan(' b4 ');
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'ref');
    assert.equal(tokens[0].lexeme, 'b4');
    assert.deepEqual(tokens[0].value, {
      col: { isAbs: false, index: 1 },
      row: { isAbs: false, index: 3 },
    });
  });

  it ('a rel/rel ref relative to a base should scan correctly', function () {
    const tokens = scan(' C5 ', new CellRef('e9'));
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'ref');
    assert.equal(tokens[0].lexeme, 'C5');
    assert.deepEqual(tokens[0].value, {
      col: { isAbs: false, index: -2 },
      row: { isAbs: false, index: -4 },
    });
  });

  it ('a rel/abs ref relative to a base should scan correctly', function () {
    const tokens = scan(' c$5 ', new CellRef('E9'));
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'ref');
    assert.equal(tokens[0].lexeme, 'c$5');
    assert.deepEqual(tokens[0].value, {
      col: { isAbs: false, index: -2 },
      row: { isAbs: true, index: 4 },
    });
  });

  it ('an abs/abs ref relative to a base should scan correctly', function () {
    const tokens = scan(' $c$5 ', new CellRef('c4'));
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0].type, 'ref');
    assert.equal(tokens[0].lexeme, '$c$5');
    assert.deepEqual(tokens[0].value, {
      col: { isAbs: true, index: 2 },
      row: { isAbs: true, index: 4 },
    });
  });

  it ('multiple tokens should scan correctly', function () {
    const tokens = scan('123e-2 + ( $A2 * c3 )', new CellRef('C4'));
    assert.equal(tokens.length, 8);
    assert.deepEqual(tokens.map(t => t.type),
		     [ 'num', '+', '(', 'ref', '*', 'ref', ')', '<EOF>' ]);
    assert.equal(tokens[0].value, 1.23);
    assert.deepEqual(tokens[3].value,
		     { col: { isAbs: true, index: 0 },
		       row: { isAbs: false, index: -2 },
		     });
    assert.deepEqual(tokens[5].value,
		     { col: { isAbs: false, index: 0 },
		       row: { isAbs: false, index: -1 },
		     });
  });

});	
