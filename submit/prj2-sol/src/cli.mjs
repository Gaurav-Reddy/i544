import parse from './expr-parser.mjs';
import AppError from './app-error.mjs';
import Spreadsheet from './persistent-spreadsheet.mjs';

import assert from 'assert';
import fs from 'fs';
import Path from 'path';
import util from 'util';

const readFile = util.promisify(fs.readFile);

/** handler for load command */
async function loadFile(fileName) {
  const spreadsheet = this;
  const results = {};
  const data = await readJson(fileName);
  for (const assign of data) {
    Object.assign(results, await spreadsheet.eval(...assign));
  }
  return results;
}

async function readJson(jsonPath) {
  try {
    let text;
    if (jsonPath.endsWith('.gz')) {
      //will need to import exec() if this line is activated
      const {stdout, stderr} = await exec(`zcat ${jsonPath}`);
      if (stderr) throw stderr;
      text = stdout.trim();
    }
    else {
      text = await readFile(jsonPath, 'utf8');
    }
    return JSON.parse(text);
  }
  catch (err) {
    throw [ `cannot read ${jsonPath}: ${err}` ];
  }
}

class CmdArg {
  constructor(name, type, options={}) {
    Object.assign(this,  {name, type, options});
  }
  toString() {
    return this.options.isOptional ? `[${this.name}]` : this.name;
  }

  check(val) {
    const isOk =
	  (this.type === 'cellRef' && val.match(/^[a-zA-Z]+\d+$/)) ||
	  (this.type === 'str');
    if (!isOk) {
      console.error(`invalid value '${val}' for ${this.name}; ` +
		    `must be a ${this.type}`);
    }
    return isOk;
  }
  
};

const CMD_WIDTH = 8;

class Cmd {
  constructor(name, msg, act, ...args) {
    Object.assign(this,  {name, msg, act, args});
  }

  toString() {
    const args = this.args.map(a => a.toString()).join(' ');
    return `
    ${this.name} ${args}
      ${this.msg}
    `.replace(/\s+$/, '');
  }

  check(args) {
    if (args.length !== this.args.length) {
      console.error(`command ${this.name} needs ${this.args.length} arguments`);
      return false;
    }
    for (const [i, arg] of args.entries()) {
      if (!this.args[i].check(arg)) return false;
    }
    return true;
  }

  async doIt(spreadsheet, args) {
    return await this.act.apply(spreadsheet, args);
  }
}

const COMMANDS = Object.fromEntries(
  [
    new Cmd('clear',
	    'clear spreadsheet',
	    Spreadsheet.prototype.clear),
    new Cmd('copy',
	    'copy formula from CELL_REF_1 to cell CELL_REF_1',
	    Spreadsheet.prototype.copy,
	    new CmdArg('DEST_CELL_REF', 'cellRef'),
	    new CmdArg('SRC_CELL_REF_2', 'cellRef')),
    new Cmd('delete',
	    'delete formula in cell specified by CELL_REF',
	    Spreadsheet.prototype.delete,
	    new CmdArg('CELL_REF', 'cellRef')),
    new Cmd('dump',
	    'dump spreadsheet formulas in topological order to stdout',
	    Spreadsheet.prototype.dump),
    new Cmd('eval',
	    'eval formula FORMULA into cell CELL_REF',
	    Spreadsheet.prototype.eval,
	    new CmdArg('CELL_REF', 'cellRef'),
	    new CmdArg('FORMULA', 'str')),
    new Cmd('load',
	    'load previously dumped data from file FILE into spreadsheet',
	    loadFile,
	    new CmdArg('FILE', 'str')),
    new Cmd('query',
	    'return formula and current value of cell specified by CELL_REF',
	    Spreadsheet.prototype.query,
	    new CmdArg('CELL_REF', 'cellRef')),
  ].map(cmd => [cmd.name, cmd])
);

/** output usage message */
function usage() {
  let msg =
    `usage: ${Path.basename(process.argv[1])} MONGO_DB_URL ` +
    `SPREADSHEET_NAME CMD [ARGS...]\n`;
  msg += 'Command CMD can be';
  Object.values(COMMANDS).forEach( cmd => msg += cmd.toString());
  console.error(msg);
  process.exit(1);
}

/** Top level routine */
export default async function go() {
  if (process.argv.length < 4) {
    usage();
  }
  const args = process.argv.slice(2);
  assert(args.length >= 3);
  const [ mongoDbUrl, spreadsheetName, cmdName, ...cmdArgs ] = args;
  let spreadsheet;
  try {
    spreadsheet = await Spreadsheet.make(mongoDbUrl, spreadsheetName);
    const cmd = COMMANDS[cmdName];
    if (!cmd) {
      console.error(`invalid command ${cmdName}: must be one of ` +
		    Object.keys(COMMANDS).join('|'));
      usage();
    }
    else if (!cmd.check(cmdArgs)) {
      usage();
    }
    else {
      const results = await cmd.doIt(spreadsheet, cmdArgs);
      if (results !== undefined) console.log(JSON.stringify(results, null, 2));
    }
  }
  catch (err) {
    if (err instanceof AppError) {
      console.error(err.toString());
    }
    else {
      throw err;
    }
  }
  finally {
    if (spreadsheet) await spreadsheet.close();
  }
}


