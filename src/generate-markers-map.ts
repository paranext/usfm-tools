import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { MarkersMap } from './markers-map.model.template';
import { isVersion3_1OrHigher, transformUsxSchemaToMarkersMap } from './markers-map.util';
import { execCommand } from './command-line.util';

(async () => {
  try {
    // Parse command line arguments
    program
      .option('--schema <path>', 'Path to the USX RelaxNG schema file relative to repo root')
      .option('--version <version>', 'Schema version to include in output')
      .option('--repo <repo>', 'URL of the git repo the schema file is from to include in output')
      .option('--commit <commit>', 'Commit hash the schema file is from to include in output')
      .option(
        '--outJSON <outJSON>',
        'Path to the output markers JSON file relative to repo root',
        'dist/markers.json'
      )
      .parse(process.argv);

    const options = program.opts();

    if (!options.schema || !options.version || !options.repo || !options.commit) {
      console.error('Error: --schema, --version, --repo, and --commit arguments are required');
      process.exit(1);
    }

    const schemaPath = path.resolve(options.schema);
    const schemaVersion = options.version;
    const repo = options.repo;
    const commit = options.commit;
    const outJSONPath = path.resolve(options.outJSON);

    // Get the current tag or commit for this repo
    let usfmToolsCommit = '';
    const tagCommand = 'git tag --points-at HEAD';
    const tagResult = await execCommand(tagCommand, { quiet: true });
    if (tagResult.stderr) {
      console.error(
        `Error: '${
          tagCommand
        }' returned with stderr ${tagResult.stderr.toString()}. Cannot continue`
      );
      process.exit(1);
    }
    if (tagResult.stdout) usfmToolsCommit = tagResult.stdout.toString();
    else {
      const commitCommand = 'git rev-parse HEAD';
      const commitResult = await execCommand(commitCommand, { quiet: true });
      if (commitResult.stderr) {
        console.error(
          `Error: '${commitCommand}' returned with stderr ${commitResult.stderr.toString()}. Cannot continue`
        );
        process.exit(1);
      }
      if (commitResult.stdout) usfmToolsCommit = commitResult.stdout.toString();
    }
    if (!usfmToolsCommit) {
      console.log('Somehow we could not get usfmToolsVersion. Cannot continue');
      process.exit(1);
    }
    usfmToolsCommit = usfmToolsCommit.trim();

    // Check for working changes
    const workingChangesCommand = 'git status --porcelain=v2';
    const workingChangesResult = await execCommand(workingChangesCommand, { quiet: true });
    if (workingChangesResult.stderr) {
      console.error(
        `Error: '${workingChangesCommand}' returned with stderr ${workingChangesResult.stderr.toString()}. Cannot continue`
      );
      process.exit(1);
    }
    if (workingChangesResult.stdout) {
      // If all working changes are inside the `src/test-data` folder, we can ignore
      const workingChangesTable = workingChangesResult.stdout
        .toString()
        .trim()
        .split('\n')
        .map(workingChangeRowString => workingChangeRowString.split(' '));

      // The path (always with forward slashes) is at index 8
      if (workingChangesTable.some(row => !row[8].startsWith('src/test-data/')))
        usfmToolsCommit = `${usfmToolsCommit}+`;
    }

    // Read and parse the schema file
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Get the 3.1 markers map to fill in missing information on the less-than-3.1 maps
    const baseMarkersMap: MarkersMap | undefined = isVersion3_1OrHigher(schemaVersion)
      ? undefined
      : JSON.parse(fs.readFileSync('src/markers-3.1.json', 'utf-8'));

    // Track which definitions are skipped
    const skippedDefinitions = new Set<string>();

    // Generate the markers map
    const markersMap: MarkersMap = transformUsxSchemaToMarkersMap(
      schemaContent,
      schemaVersion,
      repo,
      commit,
      usfmToolsCommit,
      skippedDefinitions,
      baseMarkersMap
    );

    // Create the dist directory if it doesn't exist
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist');
    }

    // Write the output markers JSON file
    fs.writeFileSync(outJSONPath, JSON.stringify(markersMap, undefined, 2), 'utf-8');

    // Read the markers map model template file
    const markersMapModelPath = path.resolve(__dirname, 'markers-map.model.template.ts');
    const markersMapModelContent = fs.readFileSync(markersMapModelPath, 'utf-8');

    // Replace the placeholder with the generated map
    let updatedMarkersMapModelContent = markersMapModelContent.replace(
      "JSON.parse('%USFM_MARKERS_MAP_REPLACE_ME%')",
      `${JSON.stringify(markersMap, undefined, 2)}`
    );

    // Figure out the line endings and add the generated warning at the top
    const lineEnding = markersMapModelContent.includes('\r\n') ? '\r\n' : '\n';
    updatedMarkersMapModelContent = `/** WARNING: This file is generated in https://github.com/paranext/usfm-tools. Make changes there */${lineEnding}${lineEnding}${updatedMarkersMapModelContent}`;

    // Write the updated markers map model file to dist
    fs.writeFileSync('dist/markers-map.model.ts', updatedMarkersMapModelContent, 'utf-8');

    console.log('Generated markers.json successfully');
    console.log('\nSkipped definitions:');
    console.log(Array.from(skippedDefinitions).sort().join('\n'));
  } catch (e) {
    console.error(`Uncaught error in generate-markers-map async IIFE: ${e}`);
    process.exit(1);
  }
})();
