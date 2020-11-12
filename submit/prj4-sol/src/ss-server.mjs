import Path from 'path';

import express from 'express';
import bodyParser from 'body-parser';

import querystring from 'querystring';

import { AppError, Spreadsheet } from 'cs544-ss';

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
  app.listen(port, function () {
    console.log(`listening on port ${port}`);
  });
}


/*********************** Routes and Handlers ***************************/

function setupRoutes(app) {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.get(`/`, indexLoad(app));                                              //this is to load in the beginning
  app.post(`/`, bodyParser.urlencoded({ extended: false }), searchCells(app));  //this is ffrom form of index to table page
  app.post(`/ss/:name`, bodyParser.urlencoded({ extended: false }), actionForm(app));  //this is from the form in table page
  //@TODO add routes
  //must be last
  app.use(do404(app));
  app.use(doErrors(app));

}

//@TODO add handlers 
/**this is the action form from its called from the main table page 
 * and if there are problems we send the page back again with errors message
 * all processing for clearing,updating deleteing spreadsheet is present here
 */

function actionForm(app) {
  return async function (req, res) {
    try {
      let errors = {};
      const action = req.body.ssAct;
      const returnForm = { 'sentCellId': req.body.cellId, 'sentFormula': req.body.formula };
      returnForm[action] = true;
      validateUpdate(req.body, errors);             //check the input for basic errors

      if (Object.keys(errors).length != 0) {          //this will execute in only in there are no errors input
        const sheet = await Spreadsheet.make(req.params.name, app.locals.store);
        const viewData = await buildTable(req.params.name, sheet);    //build the mustache obj for table
        let viewBuild = { name: req.params.name, ...errors, ...returnForm }; //this obj is the one we send to mustache
        viewBuild.table = viewData;
        res.status(BAD_REQUEST).
          send(app.locals.mustache.render('sheet', viewBuild));
      } else {
        const sheet = await Spreadsheet.make(req.params.name, app.locals.store);//this execute if there are no errors from valifdate
        let retunFormApperror = {};
        let errors = {};
        try {      //this try is for catch the errors like cricular ref
          let returnFromFunction = {};
          switch (action) {     //perform all action in spread sheet
            case 'clear':
              returnFromFunction = await sheet.clear();
              break;
            case 'deleteCell':
              returnFromFunction = await sheet.delete(returnForm.sentCellId);
              break;
            case 'updateCell':
              
              returnFromFunction = await sheet.eval(returnForm.sentCellId, returnForm.sentFormula);
              break;
            case 'copyCell':
              console.log(returnForm.sentCellId+'<->'+returnForm.sentFormula);
              returnFromFunction = await sheet.copy(returnForm.sentCellId, returnForm.sentFormula);
              break;
            default:
              console.error("the program must never reach here"); process.exit(-1);
          }
        } catch (err) {
          const map = (mapError(err)); //maperror err taken from the prj3 
          errors.formula = map.error.message;
          retunFormApperror = returnForm;
        } finally {
          const viewData = await buildTable(req.params.name, sheet);
          let viewBuild = { name: req.params.name, ...errors, ...retunFormApperror };
          viewBuild.table = viewData;
          res.status(BAD_REQUEST).
            send(app.locals.mustache.render('sheet', viewBuild));
        }

      }
    } catch (err) {
      console.log(err);
    }
  };
}
function searchCells(app) {// this route is to load the table 1st time after the index page
  return async function (req, res) {

    try {

      const errorMsg = {};
      const isValid = validateField('ssName', req.body, errorMsg);
      const sentName = req.body.ssName;
      //console.log({ 'Sname':sentName,errorMessage: errorMsg['ssName'] });
      if (!isValid) {//send if errors are present
        res.status(BAD_REQUEST).
          send(app.locals.mustache.render('index', { 'Sname': sentName, errorMessage: errorMsg['ssName'] }));
      } else {
        //-------------------------------------------->retrive from db
        const sheet = await Spreadsheet.make(sentName, app.locals.store);
        const viewData = await buildTable(req.body.ssName, sheet);
        //console.log({table:viewData});
        //-------------------------------------------->retrive from db END
        res.status(OK).
          send(app.locals.mustache.render('sheet', { name: req.body.ssName, table: viewData }));
      }
    } catch (err) {
      console.log(err);
    }

  };
}

function indexLoad(app) {//this is the 1st get to lod index page
  return async function (req, res) {

    res.status(OK).
      send(app.locals.mustache.render('index', { 'Sname': '', errorMessage: "" }));
  };
}
/** Default handler for when there is no route for a particular method
 *  and path. 
 */
function do404(app) {
  return async function (req, res) {
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
  return async function (err, req, res, next) {
    res.status(SERVER_ERROR);
    res.send(app.locals.mustache.render('errors',
      { errors: [{ msg: err.message, }] }));
    console.error(err);
  };
}

/************************* SS View Generation **************************/

const MIN_ROWS = 10;
const MIN_COLS = 10;

//@TODO add functions to build a spreadsheet view suitable for mustache

/**
 * this is used to build the table
 * @param name name of the sheet
 * @param sheet sheet obj of spreadsheet class
 * a breif explanation of the function below
 * 1.get datadump of the sheet as cell anf formula
 * 2.getNoofRowsAndCols(cellids) get the no of cols and rows in the table 
 * 3.create and empty array (2-d) of the rows and cols
 * 4.now push the cell values in the 2d array where a1-[0,0];a2-[0,1];b1-[1,0]
 */
async function buildTable(name, sheet) {

  const data = sheet.dump();
  const cellids = [];
  for (const id of data) { cellids.push(id[0]); }
  const rowsCols = getNoofRowsAndCols(cellids);


  let dataArray = createEmptyArray(rowsCols[0], rowsCols[1]);  //create an empty array;will be filled with data
  //dataArray.push(getFirstRow(name,rowsCols[0]));
  if (data.length != 0) { fillDataArray(cellids, dataArray, sheet); }             //populate with data
  let dataJson = [];
  let sNo = 0;
  for (const rowD of dataArray) {
    sNo++;
    if (sNo === 1) { dataJson.push({ row: getFirstRow(name, rowsCols[1]).join('') }) }
    dataJson.push({ row: '<th>' + sNo + '</th>' + rowD.join('') });
  }

  return dataJson;
};
function fillDataArray(array, dataArray, connector) {
  for (const i of array) {

    const cellvalue = connector.query(i).value;
    const rowNo = parseInt(i.substr(1)) - 1;
    const colNo = i[0].charCodeAt(0) - 96 - 1;  //https://stackoverflow.com/questions/22624379/how-to-convert-letters-to-numbers-with-javascript
    //console.log(rowNo+'x'+colNo+'-'+i+'--'+cellvalue);
    //console.log(dataArray);
    dataArray[rowNo][colNo] = '<td>' + cellvalue + '</td>';

  }
}
function createEmptyArray(rowsNo, colsNo) {
  return new Array(rowsNo).fill('<td>&nbsp;</td>').map(() => new Array(colsNo).fill('<td>&nbsp;</td>'));
}
function getFirstRow(name, rowsno) {
  const row = [];
  for (let i = 0; i < rowsno; i++) {
    row.push('<th>' + (String.fromCharCode(i + 97)).toUpperCase() + '</th>');
  }
  return ['<th>' + name + "</th>"].concat(row);
}

function getNoofRowsAndCols(data) {

  let cols = []; let rows = [];
  for (const i of data) { cols.push(i[0]); }
  for (const j of data) { rows.push(j.substr(1)); }
  if (data.length === 0) { return [MIN_ROWS, MIN_COLS] }
  cols.sort(); rows.sort(function (a, b) { return a - b });
  const rowNo = parseInt(rows[rows.length - 1]) > MIN_ROWS ? parseInt(rows[rows.length - 1]) : MIN_ROWS;
  const colNo = cols[cols.length - 1].charCodeAt(0) - 96 > MIN_COLS ? cols[cols.length - 1].charCodeAt(0) - 96 : MIN_COLS;  //https://stackoverflow.com/questions/22624379/how-to-convert-letters-to-numbers-with-javascript
  return [rowNo, colNo];
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
      const isOk = validateFields('Copy Cell', ['cellId', 'formula'], [],
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
      return validateFields('Update Cell', ['cellId', 'formula'], [],
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
/**This function is used to maperrors taken from project 3*/
const ERROR_MAP = {
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code and an error property containing an object with with code and
 *  message properties.
 */
function mapError(err) {
  const isDomainError = (err instanceof AppError);
  const status =
    isDomainError ? (ERROR_MAP[err.code] || BAD_REQUEST) : SERVER_ERROR;
  const error =
    isDomainError
      ? { code: err.code, message: err.message }
      : { code: 'SERVER_ERROR', message: err.toString() };
  if (!isDomainError) console.error(err);
  return { status, error };
}

/** these are to map out errors thwn by web services G */
function wsErrors(err) {
  const msg = (err.message) ? err.message : 'web service error';
  console.error(msg);
  return { _: [msg] };
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

