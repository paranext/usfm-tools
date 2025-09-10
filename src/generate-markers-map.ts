import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { MarkersMap } from './markers-map.model.template';
import { transformUsxSchemaToMarkersMap } from './markers-map.util';

// Parse command line arguments
program
  .option('--schema <path>', 'Path to the USX RelaxNG schema file relative to repo root')
  .option('--version <version>', 'Schema version to include in output')
  .option('--commit <commit>', 'Commit hash the schema file is from to include in output')
  .option('--outJSON <outJSON>', 'Path to the output markers JSON file relative to repo root', 'dist/markers.json')
  .parse(process.argv);

const options = program.opts();

if (!options.schema || !options.version || !options.commit) {
  console.error('Error: --schema, --version, and --commit arguments are required');
  process.exit(1);
}

const schemaPath = path.resolve(options.schema);
const schemaVersion = options.version;
const commit = options.commit;
const outJSONPath = path.resolve(options.outJSON);

// Read and parse the schema file
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Track which definitions are skipped
const skippedDefinitions = new Set<string>();

// Generate the markers map
const markersMap: MarkersMap = transformUsxSchemaToMarkersMap(
  schemaContent,
  schemaVersion,
  commit,
  skippedDefinitions
);

// Create the dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Write the output markers JSON file
fs.writeFileSync(outJSONPath, JSON.stringify(markersMap, null, 2), 'utf-8');

// Read the markers map model file, replace the placeholder with the generated map, and write it to dist
const markersMapModelPath = path.resolve(__dirname, 'markers-map.model.template.ts');
const markersMapModelContent = fs.readFileSync(markersMapModelPath, 'utf-8');
const updatedMarkersMapModelContent = markersMapModelContent.replace(
  " = '%USFM_MARKERS_MAP_REPLACE_ME%'",
  `: MarkersMap = ${JSON.stringify(markersMap, null, 2)}`
);
fs.writeFileSync('dist/markers-map.model.ts', updatedMarkersMapModelContent, 'utf-8');

console.log('Generated markers.json successfully');
console.log('\nSkipped definitions:');
console.log(Array.from(skippedDefinitions).sort().join('\n'));
