import parse from './expr-parser.mjs';
import AppError from './app-error.mjs';
import { cellRefToCellId } from './util.mjs';


/**
 * User errors are reported by throwing a suitable AppError object
 * having a suitable message property and code property set as
 * follows:
 *
 *  `SYNTAX`: for a syntax error.
 *  `CIRCULAR_REF` for a circular reference.
 */

// names of private (not to be used outside this class) methods/properties 
// start with an '_'.
export default class MemSpreadsheet {

  constructor() {
    this._cells = {};  //map from cellIds to CellInfo objects
    this._undos = {};  //map from cellIds to previous this._cells[cellId]
  }
  
  /** Set cell with id baseCellId to result of evaluating string
   *  formula.  Update all cells which are directly or indirectly
   *  dependent on the base cell.  Return an object mapping the id's
   *  of all dependent cells to their updated values.  
   */
  eval(baseCellId, formula) {
    try {
      this._undos = {};
      const cellId = cellRefToCellId(baseCellId);
      const oldAst = this._cells[cellId]?.ast;
      const ast = parse(formula, cellId);
      const cell = this._updateCell(cellId, cell => cell.ast = ast);
      if (oldAst) this._removeAsDependent(cellId, oldAst);
      const updates = this._evalCell(cell, new Set());
      return updates;
    }
    catch (err) {
      this.undo();
      throw err;
    }
  }

  /** return object containing formula and value for cell cellId 
   *  return { value: 0, formula: '' } for an empty cell.
   */
  query(cellId) {
    
    const id = cellId.replace(/\$/g, '');   //get_cell from project1 solution
    let cell = this._cells[id];
    
    cell = cell ?? (this._cells[id] = new CellInfo(id, this));
    return {'value':cell.value,'formula':cell.formula};
  }

  /** Clear contents of this spreadsheet. No undo information recorded. */
  clear() {
    this._undos = {};
    //@TODO
    this._cells={};
    
  }

  /** Delete all info for cellId from this spreadsheet. Return an
   *  object mapping the id's of all dependent cells to their updated
   *  values.  
   */
  delete(cellId) {
    this._undos = {};
    let updates={};
    //@TODO
    const id = cellId.replace(/\$/g, '');
    let cell = this._cells[cellId] ;
    if(cell===undefined)return updates;       //delete an not defined cell rteturn {}
    const dependents= cell.dependents;
     cell = this._updateCell(cellId, cell=> delete this._cells[cell.id]);
    if(dependents.size>0){                    //below code only if we have dependensts
     for(let id of dependents){
      const obj = this.query(id);
      let tempObj=this.eval(id,obj.formula);
      for(const[cellid,value] of Object.entries(tempObj)){//append to updates the cellid and formula
        updates[cellid]=value;
        }
      }
    }
    
    return updates;
  }

  

  /** copy formula from srcCellId to destCellId, adjusting any
   *  relative cell references suitably.  Return an object mapping the
   *  id's of all dependent cells to their updated values. Copying
   *  an empty cell is equivalent to deleting the destination cell.
   */
  copy(destCellId, srcCellId) {
    this._undos = {};
    let results = {};
    //@TODO
    
    let formulaObj= this.query(srcCellId).formula;
    if(formulaObj==="") {return this.delete(destCellId);}  //if formula is empty just delete
    else{
    const srcAst=this._cells[srcCellId].ast;
    const destFormula=srcAst.toString(destCellId);
    
    results = this.eval(destCellId,destFormula);      //else reval destcell
    return results;}
    
  }

  /** Return dump of cell values as list of cellId and formula pairs.
   *  Do not include any cell's with empty formula.
   *
   *  Returned list must be sorted by cellId with primary order being
   *  topological (cell A < cell B when B depends on A) and secondary
   *  order being lexicographical (when cells have no dependency
   *  relation). 
   *
   *  Specifically, the cells must be dumped in a non-decreasing depth
   *  order:
   *     
   *    + The depth of a cell with no dependencies is 0.
   *
   *    + The depth of a cell C with direct prerequisite cells
   *      C1, ..., Cn is max(depth(C1), .... depth(Cn)) + 1.
   *
   *  Cells having the same depth must be sorted in lexicographic order
   *  by their IDs.
   *
   *  Note that empty cells must be ignored during the topological
   *  sort.
   */
  dump(){
    let final_array=[];
   
  let dependencies = this._makePrereqs();

// 1st loop is for adding cells with no dependents
// then you push to array and  delete
// the added key and value from dependencies 
for(const[cellid,dependents] of Object.entries(dependencies)){
      if(dependents.length==0){
        let formulaObj= this.query(cellid).formula;
        final_array.push([cellid,formulaObj]);
        delete dependencies[`${cellid}`];
        
}}

//this used to sort the array in lexical order
function Comparator(a, b) {
  if (a[0] < b[0]) return -1;
  if (a[0] > b[0]) return 1;
  return 0;
}
final_array = final_array.sort(Comparator);

//this loop is for left over elements 
//we now go through each element of the final_arry
//then we check if its presnt in the dependents of each 
//element in dependecies if present then we add formula and cell to the final array

    for( const elem of final_array  ){
   
    for(const[cellid,dependents] of Object.entries(dependencies)){
      if(dependents.includes(elem[0])){
        let formulaObj= this.query(cellid).formula;
        final_array.push([cellid,formulaObj]);
        delete dependencies[`${cellid}`];
      }

    }
       
    }
    
    return final_array;
  }

  

  /** undo all changes since last operation */
  undo() {
    for (const [k, v] of Object.entries(this._undos)) {
      if (v) {
	this._cells[k] = v;
      }
      else {
	delete this._cells[k];
      }
    }
  }

  /** Return object mapping cellId to list containing prerequisites
   *  for cellId for all non-empty cells.
   */
  _makePrereqs() {
    const prereqCells =
       Object.values(this._cells).filter(cell => !cell.isEmpty());
    const prereqs = Object.fromEntries(prereqCells.map(c => [c.id, []]));
    for (const cell of prereqCells) {
      for (const d of cell.dependents) {
	if (prereqs[d]) prereqs[d].push(cell.id);
      }
    }
    return prereqs;
  }

  // must update all cells using only this function to guarantee
  // recording undo information.
  _updateCell(cellId, updateFn) {
    if (!(cellId in this._undos)) {
      this._undos[cellId] = this._cells[cellId]?.copy();
    }
    const cell =
      this._cells[cellId] ?? (this._cells[cellId] = new CellInfo(cellId));
    updateFn(cell);
    return cell;
  }

  // you should not need to use these remaining methods.

  _evalCell(cell, working) {
    const value = this._evalAst(cell.id, cell.ast);
    this._updateCell(cell.id, cell => cell.value = value);
    const vals = { [cell.id]: value };
    working.add(cell.id);
    for (const dependent of cell.dependents) {
      if (working.has(dependent)) {
	const msg = `circular ref involving ${dependent}`;
	throw new AppError('CIRCULAR_REF', msg);
      }
      const depCell = this._cells[dependent];
      Object.assign(vals, this._evalCell(depCell, working));
    }
    working.delete(cell.id);
    return vals;
  }

  _evalAst(baseCellId, ast) {
    if (ast === null) {
      return 0;
    }
    else if (ast.type === 'num') {
      return ast.value;
    }
    else if (ast.type === 'ref') {
      const cellId = cellRefToCellId(ast.toString(baseCellId));
      const cell =
	this._updateCell(cellId, cell => cell.dependents.add(baseCellId));
      return cell.value;
    }
    else {
      console.assert(ast.type === 'app', `unknown ast type ${ast.type}`);
      const f = FNS[ast.fn];
      console.assert(f, `unknown ast fn ${ast.fn}`);
      return f(...ast.kids.map(k => this._evalAst(baseCellId, k)));
    }
  }

  _removeAsDependent(baseCellId, ast) {
    if (ast.type === 'app') {
      ast.kids.forEach(k => this._removeAsDependent(baseCellId, k));
    }
    else if (ast.type === 'ref') {
      const cellId = cellRefToCellId(ast.toString(baseCellId));
      this._updateCell(cellId, cell => cell.dependents.delete(baseCellId));
    }
  }

}



class CellInfo {
  constructor(id) {
    this.id = id;
    this.value = 0;    //cache of current value, not strictly necessary
    this.ast = null;
    this.dependents = new Set(); //cell-ids of cells which depend on this
    //equivalently, this cell is a prerequisite for all cells in dependents
    //this.formula= this.formula();
  }

  //formula computed on the fly from the ast
  get formula() { return this.ast ? this.ast.toString(this.id) : ''; }

  //empty if no ast (equivalently, the formula is '').
  isEmpty() { return !this.ast; }
  
  copy() {
    const v = new CellInfo(this.id);
    Object.assign(v, this);
    v.dependents = new Set(v.dependents);
    return v;   
  }

}

const FNS = {
  '+': (a, b) => a + b,
  '-': (a, b=null) => b === null ? -a : a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
}
