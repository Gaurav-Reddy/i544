import parse from '../src/expr-parser.mjs';

import chai from 'chai';
const { assert } = chai;

import util from 'util';

describe('parse', function() {

  it ('must parse simple arith expr correctly', function () {
    const ast = parse('1 + 2*3');
    assert.equal(ast.toString(), '1+2*3');
  });

  it ('must parse simple prec expr correctly', function () {
    const ast = parse('(  (1 + 2)*3 )');
    assert.equal(ast.toString().replace(/\s/g, ''), '(1+2)*3');
  });

  it ('must parse assoc expr correctly', function () {
    const ast = parse('(1 + 2 - 3 )');
    assert.equal(ast.toString().replace(/\s/g, ''), '1+2-3');
  });

  it ('must parse paren-assoc expr correctly', function () {
    const ast = parse('(1 + (2 - 3) )');
    assert.equal(ast.toString().replace(/\s/g, ''), '1+(2-3)');
  });

  it ('must parse unary - expr correctly', function () {
    const ast = parse('(--1 + (2))');
    assert.equal(ast.toString().replace(/\s/g, ''), '-(-1)+2');
  });

  it ('must parse function expr correctly', function () {
    const ast = parse('(1 + max((2 + 3)*4, 5, 6))');
    assert.equal(ast.toString().replace(/\s/g, ''), '1+max((2+3)*4,5,6)');
  });

  it ('must parse nested function expr correctly', function () {
    const ast = parse('(1 + max((2 + 3)*4, min(5, 6)))');
    assert.equal(ast.toString().replace(/\s/g, ''), '1+max((2+3)*4,min(5,6))');
  });

  it ('must parse cell ref correctly', function () {
    const ast = parse('c$1', 'a1');
    assert.equal(ast.toString().replace(/\s/g, ''), 'c$1');
  });

  it ('must translate cell ref correctly', function () {
    const ast = parse('c2', 'a5');
    assert.equal(ast.toString('f6').replace(/\s/g, ''), 'h3');
  });

  it ('must translate cell ref without translating abs', function () {
    const ast = parse('c$2', 'a5');
    assert.equal(ast.toString('f6').replace(/\s/g, ''), 'h$2');
  });

  it ('must parse and translate complex formula', function () {
    const ast = parse('((1 + C$2)*$b3)', 'A5');
    //console.log(util.inspect(ast, false, null));
    assert.equal(ast.toString('f6').replace(/\s/g, ''), '(1+h$2)*$b4');
  });


});	
