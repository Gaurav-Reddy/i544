import Path from 'path';

import express from 'express';
import bodyParser from 'body-parser';

import querystring from 'querystring';

import {AppError, Spreadsheet} from 'cs544-ss';

import Mustache from './mustache.mjs';

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

//some common HTTP status codes; not all codes may be necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

const __dirname = Path.dirname(new URL(import.meta.url).pathname);

export default function serve(port, store) {
  process.chdir(__dirname);
  const app = express();
  app.locals.port = port;
  app.locals.store = store;
  app.locals.mustache = new Mustache();
  app.use('/', express.static(STATIC_DIR));
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


/*********************** Routes and Handlers ***************************/

function setupRoutes(app) {
  app.use(bodyParser.urlencoded({extended: true}));
  app.get(`/`,indexLoad(app));
  app.post(`/`,bodyParser.urlencoded({extended: false}),searchCells(app)); 
  //@TODO add routes
  //must be last
  app.use(do404(app));
  app.use(doErrors(app));

}

//@TODO add handlers 

/** Default handler for when there is no route for a particular method
 *  and path. 
 */
function searchCells(app){
  return async function(req, res) {
    
    try{
      const errorMsg={};
      const isValid=validateField('ssName',req.body,errorMsg);
      
      
      if(!isValid){
        res.status(BAD_REQUEST).
      send(app.locals.mustache.render('index',{ errorMessage: errorMsg['ssName'] }));
      }
      //-------------------------------------------->retrive from db
      
      
      const viewData= await buildTable(req.body.ssName,app.locals.store);
      console.log({table:viewData});
      //-------------------------------------------->retrive from db END
      res.status(OK).
      send(app.locals.mustache.render('test',{table:viewData}));
    }catch(err){
      console.log(err);
    }
    
   
  };
}

function indexLoad(app){
  return async function(req, res) {
    
    res.status(OK).
      send(app.locals.mustache.render('index',{errorMessage:""}));
  };
}
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    res.status(NOT_FOUND).
      send(app.locals.mustache.render('errors',
				      { errors: [{ msg: message, }] }));
  };
}

/** Ensures a server error results in an error page sent back to
 *  client with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.send(app.locals.mustache.render('errors',
					{ errors: [ {msg: err.message, }] }));
    console.error(err);
  };
}

/************************* SS View Generation **************************/

const MIN_ROWS = 10;
const MIN_COLS = 10;

//@TODO add functions to build a spreadsheet view suitable for mustache

async function buildTable(name,store){
  const sheet = await Spreadsheet.make(name,store);
  const data=sheet.dump();
  const cellids=[];
  for(const id of data){cellids.push(id[0]);}
  const rowsCols=getNoofRowsAndCols(cellids);
  
  
  let dataArray=createEmptyArray(rowsCols[0],rowsCols[1]);  //create an empty array;will be filled with data
  //dataArray.push(getFirstRow(name,rowsCols[0]));
  if(data.length!=0){fillDataArray(cellids,dataArray,sheet);}             //populate with data
  let dataJson=[];
  let sNo=0;
  for (const rowD of dataArray){
    sNo++;
    if(sNo===1){dataJson.push({row:getFirstRow(name,rowsCols[0]).join('')})}
    dataJson.push({row:'<td><b>'+sNo+'</b></td>'+rowD.join('')});
  }
  
  return dataJson;
};
function fillDataArray(array,dataArray,connector){
  for(const i of array){
    
    const cellvalue=connector.query(i).value;
    const rowNo = parseInt(i.substr(1))-1;
    const colNo = i[0].charCodeAt(0)-96-1;
    dataArray[rowNo][colNo]= '<td>'+cellvalue+'</td>';
    
  }
}
function createEmptyArray(rowsNo,colsNo){
  return new Array(rowsNo).fill('<td>&nbsp;</td>').map(() => new Array(colsNo).fill('<td>&nbsp;</td>'));
}
function getFirstRow(name,rowsno){
  const row=[];
  for(let i=0;i<rowsno;i++){
    row.push('<td><b>'+(String.fromCharCode(i+97)).toUpperCase()+'</b></td>');
  }
  return ['<td><b>'+name+"</b></td>"].concat(row);
}

function getNoofRowsAndCols(data){
  
  let cols=[];let rows=[];
  for(const i of data){cols.push(i[0]);}
  for(const j of data){rows.push(j.substr(1));}
  if(data.length===0){return [MIN_ROWS,MIN_COLS]}
  cols.sort();rows.sort();
  const rowNo=parseInt(rows[rows.length-1]-1)>MIN_ROWS?parseInt(rows[rows.length-1]-1):MIN_ROWS;
  const colNo=cols[cols.length-1].charCodeAt(0)-96>MIN_COLS?cols[cols.length-1].charCodeAt(0)-96:MIN_COLS;
  return [rowNo,colNo];
  }

/**************************** Validation ********************************/


const ACTS = new Set(['clear', 'deleteCell', 'updateCell', 'copyCell']);
const ACTS_ERROR = `Action must be one of ${Array.from(ACTS).join(', ')}.`;

//mapping from widget names to info.
const FIELD_INFOS = {
  ssAct: {
    friendlyName: 'Action',
    err: val => !ACTS.has(val) && ACTS_ERROR,
  },
  ssName: {
    friendlyName: 'Spreadsheet Name',
    err: val => !/^[\w\- ]+$/.test(val) && `
      Bad spreadsheet name "${val}": must contain only alphanumeric
      characters, underscore, hyphen or space.
    `,
  },
  cellId: {
    friendlyName: 'Cell ID',
    err: val => !/^[a-z]\d\d?$/i.test(val) && `
      Bad cell id "${val}": must consist of a letter followed by one
      or two digits.
    `,
  },
  formula: {
    friendlyName: 'cell formula',
  },
};

/** return true iff params[name] is valid; if not, add suitable error
 *  message as errors[name].
 */
function validateField(name, params, errors) {
  
  const info = FIELD_INFOS[name];
  const value = params[name];
  
  if (isEmpty(value)) {
    errors[name] = `The ${info.friendlyName} field must be specified`;
  
    return false;
  }
  if (info.err) {
    const err = info.err(value);
    if (err) {
      errors[name] = err;
      return false;
    }
  }
  return true;
}

  
/** validate widgets in update object, returning true iff all valid.
 *  Add suitable error messages to errors object.
 */
function validateUpdate(update, errors) {
  const act = update.ssAct ?? '';
  switch (act) {
    case '':
      errors.ssAct = 'Action must be specified.';
      return false;
    case 'clear':
      return validateFields('Clear', [], ['cellId', 'formula'], update, errors);
    case 'deleteCell':
      return validateFields('Delete Cell', ['cellId'], ['formula'],
			    update, errors);
    case 'copyCell': {
      const isOk = validateFields('Copy Cell', ['cellId','formula'], [],
				  update, errors);
      if (!isOk) {
	return false;
      }
      else if (!FIELD_INFOS.cellId.err(update.formula)) {
	  return true;
      }
      else {
	errors.formula = `Copy requires formula to specify a cell ID`;
	return false;
      }
    }
    case 'updateCell':
      return validateFields('Update Cell', ['cellId','formula'], [],
			    update, errors);
    default:
      errors.ssAct = `Invalid action "${act}`;
      return false;
  }
}

function validateFields(act, required, forbidden, params, errors) {
  for (const name of forbidden) {
    if (params[name]) {
      errors[name] = `
	${FIELD_INFOS[name].friendlyName} must not be specified
        for ${act} action
      `;
    }
  }
  for (const name of required) validateField(name, params, errors);
  return Object.keys(errors).length === 0;
}


/************************ General Utilities ****************************/
/** these are to map out errors thwn by web services G */
function wsErrors(err) {
  const msg = (err.message) ? err.message : 'web service error';
  console.error(msg);
  return { _: [ msg ] };
}
/** return new object just like paramsObj except that all values are
 *  trim()'d.
 */
function trimValues(paramsObj) {
  const trimmedPairs = Object.entries(paramsObj).
    map(([k, v]) => [k, v.toString().trim()]);
  return Object.fromEntries(trimmedPairs);
}

function isEmpty(v) {
  return (v === undefined) || v === null ||
    (typeof v === 'string' && v.trim().length === 0);
}

/** Return original URL for req.  If index specified, then set it as
 *  _index query param 
 */
function requestUrl(req, index) {
  const port = req.app.locals.port;
  let url = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
  if (index !== undefined) {
    if (url.match(/_index=\d+/)) {
      url = url.replace(/_index=\d+/, `_index=${index}`);
    }
    else {
      url += url.indexOf('?') < 0 ? '?' : '&';
      url += `_index=${index}`;
    }
  }
  return url;
}

