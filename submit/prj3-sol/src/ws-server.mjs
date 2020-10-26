import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';

import {AppError,DBSSStore} from 'cs544-ss';

/** Storage web service for spreadsheets.  Will report DB errors but
 *  will not make any attempt to report spreadsheet errors like bad
 *  formula syntax or circular references (it is assumed that a higher
 *  layer takes care of checking for this and the inputs to this
 *  service have already been validated).
 */

//some common HTTP status codes; not all codes may be necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;
//const ssStore=new DBSSStore();
export default function serve(port, ssStore) {
  const app = express();
  app.locals.port = port;
  app.locals.ssStore = ssStore;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
    //console.log(ssStore);
  });
}

const CORS_OPTIONS = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: 'Location',
};

const BASE = 'api';
const STORE = 'store';


function setupRoutes(app) {
  app.use(cors(CORS_OPTIONS));  //needed for future projects
  //@TODO add routes to handlers
  app.use(bodyParser.json());
  app.get(`/${BASE}/${STORE}/:sheetName`,doLoadtoList(app));
  app.delete(`/${BASE}/${STORE}/:sheetName`,doClear(app));
  app.delete(`/${BASE}/${STORE}/:sheetName/:id`,doDeleteCell(app));
  app.patch(`/${BASE}/${STORE}/:sheetName`,doUpdateSheet(app));
  app.patch(`/${BASE}/${STORE}/:sheetName/:id`,doUpdateFormula(app));
  app.put(`/${BASE}/${STORE}/:sheetName/:id`,doUpdateFormulaPut(app));
  app.put(`/${BASE}/${STORE}/:sheetName`,doReloadSheet(app));
  //nothing after this
  app.use(do404(app));
  app.use(doErrors(app));
}

/****************************** Handlers *******************************/

//@TODO
function doReloadSheet(app){
  return (async function(req,res){
    //const q = req.query || {};
    const sheetName= req.params.sheetName ;
    console.log(req.body);
    try{
      if(!validateInput(req.body,1)) {throw new AppError('BAD_REQUEST','request body must be a list of cellId, formula pairs');}
      let results = await app.locals.ssStore.clear(sheetName);
      for (const cell of req.body){
         results = await app.locals.ssStore.updateCell(sheetName,cell[0],cell[1]);
      }
      res.sendStatus(NO_CONTENT);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
    
  });

}
function doUpdateFormula(app){
  return(async function(req,res){
    const sheetName= req.params.sheetName ;
  const id= req.params.id ;
    
    try{
      if(!validateInput(req.body,2)) {throw new AppError('BAD_REQUEST','request body must be a { formula } object');}
      const results = await app.locals.ssStore.updateCell(sheetName,id,req.body.formula);
      res.sendStatus(NO_CONTENT);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}
function doUpdateFormulaPut(app){
  return(async function(req,res){
    const sheetName= req.params.sheetName ;
  const id= req.params.id ;
    
    try{
      if(!validateInput(req.body,2)) {throw new AppError('BAD_REQUEST','request body must be a { formula } object');}
      const results = await app.locals.ssStore.updateCell(sheetName,id,req.body.formula);
      res.sendStatus(CREATED);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}
function doDeleteCell(app){
  
  return(async function(req,res){
    const sheetName= req.params.sheetName ;
  const id= req.params.id ;
    
    try{
      console.log(id);
      const results = await app.locals.ssStore.delete(sheetName,id);
      res.sendStatus(NO_CONTENT);
    }
    catch{
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });

}
function doUpdateSheet(app){
  return(async function(req,res){
    const sheetName= req.params.sheetName ;
    try{
      if(!validateInput(req.body,1)) {throw new AppError('BAD_REQUEST','request body must be a list of cellId, formula pairs');}
      for (const cell of req.body){
        const results = await app.locals.ssStore.updateCell(sheetName,cell[0],cell[1]);
      }
    res.sendStatus(NO_CONTENT);}
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  });
}
function doLoadtoList(app){
  return (async function(req,res){
    //const q = req.query || {};
    const sheetName= req.params.sheetName ;
  
    try{
      const results = await app.locals.ssStore.readFormulas(sheetName);
      res.json(results);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
    
  });
}


function doClear(app){
  return (async function(req,res){
    //const q = req.query || {};
    const sheetName= req.params.sheetName ;
    try{
      const results = await app.locals.ssStore.clear(sheetName);
      res.sendStatus(NO_CONTENT);
    }
    catch(err){
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
    
  });
}

/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: NOT_FOUND,
      error: { code: 'NOT_FOUND', message, },
    };
    res.status(404).
	json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    const result = {
      status: SERVER_ERROR,
      error: { code: 'SERVER_ERROR', message: err.message },
    };
    res.status(SERVER_ERROR).json(result);
    console.error(err);
  };
}


/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  EXISTS: CONFLICT,
  NOT_FOUND: NOT_FOUND,
  BAD_REQUEST:BAD_REQUEST
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
  if (!isDomainError) console.error(isDomainError);
  return { status, error };
} 

/****************************** Utilities ******************************/



/** Return original URL for req */
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}

/**This is for validation of json file and formula obj set option 1 to json and 2 from  */
function validateInput(input,option){
  let flag=true;
  if(option==1){
    for(const f of input){
      if(f.length!=2) flag=false;
    }
  }
  else{
    if(input.formula===undefined)flag=false;
  }
  return flag;
}