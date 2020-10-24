import serve from './ws-server.mjs';

import { DBSSStore, Spreadsheet } from 'cs544-ss';

import assert from 'assert';
import child_process from 'child_process';
import fs from 'fs';
import Path from 'path';
import process from 'process';
import util from 'util';

const { promisify } = util;
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const exec = util.promisify(child_process.exec);

/*************************** Loading Data *******************************/

async function loadData(ssStore, paths) {
  for (const path of paths) {
    const ssName = Path.basename(path).replace(/\.[^.]*$/, '');
    const cellData = await readJson(path);
    let ss;
    try {
      await ssStore.clear(ssName);
      for (const [ cellId, formula ] of cellData) {
	await ssStore.updateCell(ssName, cellId, formula);
      }
    }
    catch (err) {
      console.error(err);
    }
    finally {
      if (ss) await ss.close();
    }
  } //for (const path of paths)
}


async function readJson(jsonPath) {
  try {
    const text = await readFile(jsonPath, 'utf8');
    return JSON.parse(text);
  }
  catch (err) {
    throw [ `cannot read ${jsonPath}: ${err}` ];
  }
}

/**************************** Top-Level Code ***************************/

const USAGE = `usage: ${Path.basename(process.argv[1])} PORT MONGO_DB_URL ` +
  ' [DATA_FILE...]';

function usage() {
  console.error(USAGE);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

async function go(args) {
  try {
    const [ port, mongoDbUrl ] = [ getPort(args[0]), args[1] ];
    if (!mongoDbUrl.startsWith('mongodb://')) {
      console.error(`argument "${mongoDbUrl}" does not start with mongodb://`);
      process.exit(1);
    }
    const ssStore = await DBSSStore.make(mongoDbUrl);
    await loadData(ssStore, args.slice(2));
    serve(port, ssStore);
  }
  catch (err) {
    //hopefully we should never get here.
    console.error(err);
  }
}
    

export default async function cli() {
  if (process.argv.length < 4) usage();
  await go(process.argv.slice(2));
}


