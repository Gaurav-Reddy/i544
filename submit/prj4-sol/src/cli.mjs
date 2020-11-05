import process from 'process';
import Path from 'path';

import SSClient from './ss-client.mjs';
import ssServe from './ss-server.mjs';

function usage() {
  console.error(`usage: ${Path.basename(process.argv[1])} PORT SS_WS_URL`);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

async function go(args) {
  try {
    const port = getPort(args[0]);
    const wsBaseUrl = args[1];
    const ssClient = new SSClient(wsBaseUrl);
    ssServe(port, ssClient);
  }
  catch (err) {
    console.error(err);
  }
}
    

export default async function cli() {
  if (process.argv.length !== 4) usage();
  await go(process.argv.slice(2));
}
