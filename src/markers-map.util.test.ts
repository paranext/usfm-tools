import fs from 'fs';
import path from 'path';
import { afterAll, beforeEach, expect, MockInstance, test, vi } from 'vitest';
import { MarkersMap } from './markers-map.model.template';
import { transformUsxSchemaToMarkersMap } from './markers-map.util';

// #region set up file path variables

const dirPath = __dirname ?? import.meta.dirname;
const testDataPath = path.resolve(dirPath, 'test-data');

// #endregion set up file path variables

// #region load test data files

/**
 * Regular expression to extract the console log and skipped definitions from the stdout test data
 * files
 *
 * `(?:>.*\n)+` gets past the npm logs like > npm run generate-markers-map ...
 *
 * `\n((?:.*\n)+)` captures the console log output
 *
 * `Skipped definitions:\n` matches the literal text
 *
 * `((?:.*\n)+)` captures the skipped definitions list
 */
const STDOUT_REGEXP =
  /(?:>.*\n)+\n((?:.*\n)+)Generated markers.json successfully\n\nSkipped definitions:\n((?:.*\n)+)/;

// To generate these test data files:
// 1. Put the desired usx.rng file(s) in src/test-data/
// 2. Run the generate-markers-map script with the appropriate arguments and redirect stdout to a file
// For example, to generate 3.0.7 and 3.1 files, I used the following commands in bash:
//   npm run generate-markers-map -- --schema src/test-data/usx-3.0.7.rng --version 3.0.7 --commit 6c490bb5675d281b0fa01876fe67f6e3fd50a4ce --outJSON src/test-data/markers-3.0.7.json > src/test-data/stdout-3.0.7.txt
//   npm run generate-markers-map -- --schema src/usx-3.1.rng --version 3.1 --commit 50f2a6ac3fc1d867d906df28bc00fcff729a7b76 --outJSON src/markers-3.1.json > src/test-data/stdout-3.1.txt
//
// This can be approximated in powershell, but please do not commit this as it puts a BOM at the start of the file that will cause git file churn:
//   npm run generate-markers-map -- --schema src/test-data/usx-3.0.7.rng --version 3.0.7 --commit 6c490bb5675d281b0fa01876fe67f6e3fd50a4ce --outJSON src/test-data/markers-3.0.7.json | out-file -encoding utf8 src/test-data/stdout-3.0.7.txt
//   npm run generate-markers-map -- --schema src/usx-3.1.rng --version 3.1 --commit 50f2a6ac3fc1d867d906df28bc00fcff729a7b76 --outJSON src/markers-3.1.json | out-file -encoding utf8 src/test-data/stdout-3.1.txt
//
// Note: The 3.1 markers map is used as a base from which to generate older versions, so it is stored in
// src/ instead of src/test-data. usx.rng 3.1 seems to be stable as of writing this, so this file will
// hopefully never need to be updated. It is copied in this repo for convenience.

const USX_SCHEMA_3_0_7 = fs.readFileSync(path.resolve(testDataPath, 'usx-3.0.7.rng'), 'utf-8');
const USX_SCHEMA_3_1 = fs.readFileSync(path.resolve(testDataPath, 'usx-3.1.rng'), 'utf-8');

const USFM_MARKERS_MAP_3_0_7: MarkersMap = JSON.parse(
  fs.readFileSync(path.resolve(testDataPath, 'markers-3.0.7.json'), 'utf-8')
);
const USFM_MARKERS_MAP_3_1: MarkersMap = JSON.parse(
  fs.readFileSync(path.resolve(testDataPath, 'markers-3.1.json'), 'utf-8')
);

const STDOUT_3_0_7 = fs
  .readFileSync(path.resolve(testDataPath, 'stdout-3.0.7.txt'), 'utf-8')
  .replace(/\r?\n/g, '\n');
const STDOUT_3_1 = fs
  .readFileSync(path.resolve(testDataPath, 'stdout-3.1.txt'), 'utf-8')
  .replace(/\r?\n/g, '\n');

const [, CONSOLE_LOG_3_0_7_RAW, SKIPPED_DEFINITIONS_3_0_7_RAW] = STDOUT_3_0_7.match(
  STDOUT_REGEXP
) ?? ['', 'FAILED TO MATCH STDOUT_REGEXP', 'FAILED TO MATCH STDOUT_REGEXP'];
const CONSOLE_LOG_3_0_7 = CONSOLE_LOG_3_0_7_RAW.trim().split('\n');
const SKIPPED_DEFINITIONS_3_0_7 = new Set(
  SKIPPED_DEFINITIONS_3_0_7_RAW.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
);

const [, CONSOLE_LOG_3_1_RAW, SKIPPED_DEFINITIONS_3_1_RAW] = STDOUT_3_1.match(STDOUT_REGEXP) ?? [
  '',
  'FAILED TO MATCH STDOUT_REGEXP',
  'FAILED TO MATCH STDOUT_REGEXP',
];
const CONSOLE_LOG_3_1 = CONSOLE_LOG_3_1_RAW.trim().split('\n');
const SKIPPED_DEFINITIONS_3_1 = new Set(
  SKIPPED_DEFINITIONS_3_1_RAW.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
);

// #endregion load test data files

// #region tests

let consoleMock: MockInstance;
beforeEach(() => {
  consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {
    /* do nothing */
  });
});

afterAll(() => {
  consoleMock.mockRestore();
});

test('transformUsxSchemaToMarkersMap properly transform usx.rng 3.0.7', () => {
  const skippedDefinitions = new Set<string>();
  const markersMap = transformUsxSchemaToMarkersMap(
    USX_SCHEMA_3_0_7,
    USFM_MARKERS_MAP_3_0_7.version,
    USFM_MARKERS_MAP_3_0_7.commit,
    USFM_MARKERS_MAP_3_0_7.usfmToolsVersion,
    skippedDefinitions
  );

  expect(markersMap).toEqual(USFM_MARKERS_MAP_3_0_7);
  expect(consoleMock.mock.calls.flat()).toEqual(CONSOLE_LOG_3_0_7);
  expect(skippedDefinitions).toEqual(SKIPPED_DEFINITIONS_3_0_7);
});

test('transformUsxSchemaToMarkersMap properly transform usx.rng 3.1', () => {
  const skippedDefinitions = new Set<string>();
  const markersMap = transformUsxSchemaToMarkersMap(
    USX_SCHEMA_3_1,
    USFM_MARKERS_MAP_3_1.version,
    USFM_MARKERS_MAP_3_1.commit,
    USFM_MARKERS_MAP_3_1.usfmToolsVersion,
    skippedDefinitions
  );

  expect(markersMap).toEqual(USFM_MARKERS_MAP_3_1);
  expect(consoleMock.mock.calls.flat()).toEqual(CONSOLE_LOG_3_1);
  expect(skippedDefinitions).toEqual(SKIPPED_DEFINITIONS_3_1);
});

// #endregion tests
