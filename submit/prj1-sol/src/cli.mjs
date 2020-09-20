import parse from './expr-parser.mjs';
import AppError from './app-error.mjs';
import Spreadsheet from './spreadsheet.mjs';

import readline from 'readline';

/************************* Top level routine ***************************/

export default async function go() {
  const spreadsheet = await Spreadsheet.make();
  await repl(spreadsheet);
}

const PROMPT = '>> ';

async function repl(spreadsheet) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, //no ANSI terminal escapes
    prompt: PROMPT,
  });  
  rl.on('line', async (line) => await doLine(spreadsheet, line, rl));
  rl.prompt();
}

async function doLine(spreadsheet, line, rl) {
  try {
    line = line.trim();
    if (line.length > 0) {
      const splits = line.split('=');
      if (splits.length !== 2) {
	console.error('input must be of type "cellId = expr"');
      }
      else if (splits[0].indexOf('$') >= 0) {
	console.error('cellId being assigned to cannot contain absolute refs');
      }
      else {
	const [baseCellId, expr] = [splits[0].trim(), splits[1]];
	const verifyBaseCellId = parse(baseCellId);
	const results = await spreadsheet.eval(baseCellId.trim(), expr);
	const sortedResultPairs =
              Object.keys(results).sort().map(k => [k, results[k]]);
	console.log(Object.fromEntries(sortedResultPairs));
      }
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
  rl.prompt();
}




