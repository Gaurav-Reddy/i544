import parse from './expr-parser.mjs';
import AppError from './app-error.mjs';
import { cellRefToCellId } from './util.mjs';

//use for development only
import { inspect } from 'util';
import { exit } from 'process';

export default class Spreadsheet {

  //factory method
  static async make() { return new Spreadsheet(); }

  constructor() { // this constructor is for spreadsheet
    //@TODO
    
    this.sheet = {}
    // let initalobj= {id:new_cell}

    

    //cell.id=this.id;
  }

  /** Set cell with id baseCellId to result of evaluating formula
   *  specified by the string expr.  Update all cells which are
   *  directly or indirectly dependent on the base cell.  Return an
   *  object mapping the id's of all dependent cells to their updated
   *  values.  User errors must be reported by throwing a suitable
   *  AppError object having code property set to `SYNTAX` for a
   *  syntax error and `CIRCULAR_REF` for a circular reference
   *  and message property set to a suitable error message.
   */
  
  async eval(baseCellId, expr) { 
    const updates = {};
    //@TODO
    let temp_array = this.auxeaval(baseCellId, expr);
    //exit()
    updates[temp_array[0]]= temp_array[1];
    
    return updates;
  }

  

  //@TODO add methods
   auxeaval(baseCellId, expr) {
    let ast =parse(expr,baseCellId);
    //console.log(ast);
    console.log(inspect(ast, false, Infinity));
    switch(ast.type){
      case 'num':
        return [baseCellId,ast.value]
      
      case 'app':
          
          if (ast.kids.length==1){
            return [baseCellId,-ast.kids[0].value]
          }
          else{
          this.parseASTapp(ast)
          return [baseCellId,ast.value]
          }
          
        
        
    }
  }
  array=[]

  parseTwo(ast){
    ast.kids.forEach(element=>{
      if(element.type==='num'){
        this.array.push(element.value)
      }
      else if(element.type==='app'){
        this.array.push(element.fn)
        this.parseTwo(element)
      }

    })

  }

  /*this fuction is ast with more than 
  one kids and fns below is to use it*/
   parseASTapp(ast) {
    if (ast.type === 'num' || ast.kids.length === 0)
        return;
    ast.kids.forEach(a => this.parseASTapp(a));
    let val = ast.kids.reduce((a,b) =>  this.FNS[ast.fn](a.value, b.value));
    ast.kids = [];
    ast.type = 'num';
    ast.value = val;
    delete ast.fn;
}

 FNS = {
  '+': (a, b) => a + b,
  '-': (a, b=null) => b === null ? -a : a - b ,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
}
  
}

//Map fn property of Ast type === 'app' to corresponding function.
const FNS = {
  '+': (a, b) => a + b,
  '-': (a, b=null) => b === null ? -a : a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
}


//@TODO add other classes, functions, constants etc as needed
class Cellinfo{
 
  
  constructor(id,expr,value,dependents,ast){
    this.id=id;
    this.expr=expr;
    this.value=value;
    this.dependents=dependents;
    this.ast=ast;
  }
 
}