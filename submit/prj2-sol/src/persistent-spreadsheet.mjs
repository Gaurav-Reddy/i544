import AppError from './app-error.mjs';
import MemSpreadsheet from './mem-spreadsheet.mjs';

//use for development only
import { inspect } from 'util';

import mongo from 'mongodb';

//use in mongo.connect() to avoid warning
const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };



/**
 * User errors must be reported by throwing a suitable
 * AppError object having a suitable message property
 * and code property set as follows:
 *
 *  `SYNTAX`: for a syntax error.
 *  `CIRCULAR_REF` for a circular reference.
 *  `DB`: database error.
 */

export default class PersistentSpreadsheet {

  //factory method
  static async make(dbUrl, spreadsheetName) {
    try {
      //@TODO set up database info, including reading data
      const client = await mongo.connect(dbUrl, MONGO_CONNECT_OPTIONS);
      const db = client.db();
      const sheetName =  db.collection(spreadsheetName);
      const arrayOfcells= await sheetName.find().toArray();             //array of cell:formula
      const arrayOfSheetNames=  await db.listCollections().toArray();   //arry of names of collection
      const sheetNameAsString=spreadsheetName;
      return new PersistentSpreadsheet({client,sheetName,arrayOfcells,sheetNameAsString,arrayOfSheetNames});
    }
    catch (err) {
      const msg = `cannot connect to URL "${dbUrl}": ${err}`;
      throw new AppError('DB', msg);
    }
    
  }

  constructor(props) {
    
    this.memory=new MemSpreadsheet();
  
    Object.assign(this,props);  //access the make sent properties below this line
    
    //this code is to load the data from db to memory

    for( const elem of this.arrayOfcells){
      this.memory.eval(elem.baseCellId,elem.formula);
    }
  }

  /** Release all resources held by persistent spreadsheet.
   *  Specifically, close any database connections.
   */
  async close() {
    //@TODO
    try {

      //simple await close the connection of db
      const ret = await this.client.close();
    }
    catch (err) {
      throw new AppError('DB', err.toString());
    }
  }

  /** Set cell with id baseCellId to result of evaluating string
   *  formula.  Update all cells which are directly or indirectly
   *  dependent on the base cell.  Return an object mapping the id's
   *  of all dependent cells to their updated values.
   */
  async eval(baseCellId, formula) {
    const results =  this.memory.eval(baseCellId,formula); //calling in memory eval function

    //used update one as I am not modifying _id field

    try {
      const ret =await this.sheetName.updateOne({'baseCellId':baseCellId},{$set:{'baseCellId':baseCellId,'formula':formula}},{upsert:true});
    }
    catch (err) {

      //@TODO undo mem-spreadsheet operation
      this.memory.undo();
      const msg = `cannot update "${baseCellId}: ${err}`;
      throw new AppError('DB', msg);
    }
    return results;
  }

  /** return object containing formula and value for cell cellId 
   *  return { value: 0, formula: '' } for an empty cell.
   */
  async query(cellId) {
    //calling in memory query
    let cell=this.memory.query(cellId);
    return cell; 
  }

  /** Clear contents of this spreadsheet */
  async clear() {
   
    /*
    this code is for checking if the 
    passed name is actually present in the
    list of arrayofsheet names (getting from the db.listCollection)
    ie(./index.mjs dburl Spreadsheetname clear)
    we check Spreadsheet name is in the array so hence it exists and now we dropit
    */
   
    try {
      let flag=false;
      for (const f of this.arrayOfSheetNames){
      if(f.name===this.sheetNameAsString){flag=true}
       }
       if(flag===true){await this.sheetName.drop();}

    }
    catch (err) {
      const msg = `cannot drop collection ${this.spreadsheetName}: ${err}`;
      throw new AppError('DB', msg);
    }
    /* @TODO delegate to in-memory spreadsheet */
    this.memory.clear();
    
  }

  /** Delete all info for cellId from this spreadsheet. Return an
   *  object mapping the id's of all dependent cells to their updated
   *  values.  
   */
  async delete(cellId) {
    let results;
    results = this.memory.delete(cellId); 
    
    try {
      //@TODO
      const ret =await this.sheetName.deleteOne({'baseCellId':cellId});
      const flag= Object.keys(results).length === 0 && results.constructor === Object;  //if empty only del no update

      //Below code will be excuted only if results var is NOT empty 
      //so we need to now update the formula

      if(!flag){//emtpy updates
        for(const[cellid,value] of Object.entries(results)){
          
          let formula=this.memory.query(cellid).formula;
          const ret =await this.sheetName.updateOne({'baseCellId':cellid},{$set:{'baseCellId':cellid,'formula':formula}},{upsert:true});
          }
      }
       
    }
    catch (err) {
      //@TODO undo mem-spreadsheet operation
      this.memory.undo();
      const msg = `cannot delete ${cellId}: ${err}`;
      throw new AppError('DB', msg);
    }
    return results;
  }
  
  /** copy formula from srcCellId to destCellId, adjusting any
   *  relative cell references suitably.  Return an object mapping the
   *  id's of all dependent cells to their updated values. Copying
   *  an empty cell is equivalent to deleting the destination cell.
   */
  async copy(destCellId, srcCellId) {
    let results={};
    let formulaObj= this.memory.query(srcCellId);
    const srcFormula = formulaObj.formula;          //these two lines are for getting formula using query
    
    if (!srcFormula) {
      return await this.delete(destCellId); //delete the destcell if no scrFormula is present
    }
    else {
       results = this.memory.copy(destCellId, srcCellId); 
      try {
  
      //below code updateone uses upsert so will in inserted into db if not present

      let destormula= this.memory.query(destCellId).formula; 
      const ret =await this.sheetName.updateOne({'baseCellId':destCellId},{$set:{'baseCellId':destCellId,'formula':destormula}},{upsert:true});  

      }
      catch (err) {
  //@TODO undo mem-spreadsheet operation
  this.memory.undo();
	const msg = `cannot update "${destCellId}: ${err}`;
	throw new AppError('DB', msg);
      }
      return results;
    }
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
  async dump() {
    let output =  this.memory.dump();
    return output; 
  }

}

//@TODO auxiliary functions
