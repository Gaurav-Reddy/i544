import LIMITS from './limits.mjs';

function cellRefToCellId(cellRef) {
  return cellRef.replace(/\$/g, '');
}

function colSpecToIndex(colSpec) {
  console.assert(0 < colSpec.length && colSpec.length <= 1,
		 'col coord can have only a single letter');
  const a = 'a'.codePointAt();
  return colSpec[0].codePointAt() - a;
}

function indexToColSpec(index, baseIndex=0) {
  console.assert(0 < LIMITS.MAX_N_COLS,
		 `bad col index ${index}; must be under ${LIMITS.MAX_N_COLS}`);
  const a = 'a'.codePointAt();
  return String.fromCodePoint(a + baseIndex + index);
}

function rowSpecToIndex(rowSpec) {
  const index = Number(rowSpec) - 1;
  if (index >= LIMITS.MAX_N_ROWS) {
    const msg = `bad row spec ${rowSpec}; cannot be above ${LIMITS.MAX_N_COLS}`;
    throw new AppError('LIMITS', msg);
  }
  return index;
}


function indexToRowSpec(index, baseIndex=0) {
  console.assert(index < LIMITS.MAX_N_ROWS,
		 `bad row index ${index}; must be under ${LIMITS.MAX_N_ROWS}`);
  return String(baseIndex + index + 1);
}

export {
  cellRefToCellId,
  colSpecToIndex,
  indexToColSpec,
  rowSpecToIndex,
  indexToRowSpec,
};
