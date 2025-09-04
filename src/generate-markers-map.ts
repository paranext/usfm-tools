import { DOMParser } from '@xmldom/xmldom';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';

interface MarkerInfo {
  type: string;
}

interface MarkersMap {
  version: string;
  markers: Record<string, MarkerInfo>;
}

// Parse command line arguments
program
  .option('--schema <path>', 'Path to the USX RelaxNG schema file')
  .option('--version <version>', 'Schema version to include in output')
  .parse(process.argv);

const options = program.opts();

if (!options.schema || !options.version) {
  console.error('Error: Both --schema and --version arguments are required');
  process.exit(1);
}

const schemaPath = path.resolve(options.schema);
const schemaVersion = options.version;

// Read and parse the schema file
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
const parser = new DOMParser();
const doc = parser.parseFromString(schemaContent, 'text/xml');

const markersMap: MarkersMap = {
  version: schemaVersion,
  markers: {},
};

const skippedDefinitions: Set<string> = new Set();

// Helper function to get text content of an element
function getTextContent(element: Element): string {
  return element.textContent || '';
}

// Process a define element to extract marker information
function processDefineElement(defineElement: Element) {
  const defineName = defineElement.getAttribute('name');
  if (!defineName) return;

  // Find all element nodes that contain style markers
  const elements = defineElement.getElementsByTagName('element');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const nameElements = element.getElementsByTagName('name');
    if (nameElements.length === 0) continue;

          const markerType = getTextContent(nameElements[0]).trim();
          if (!markerType) continue;

          // Skip table elements
          if (defineName.includes('Table') || defineName === 'cell.align.enum') {
            continue;
          }    // Look for style attribute values either directly or in referenced enums
    const attributes = element.getElementsByTagName('attribute');
    for (let j = 0; j < attributes.length; j++) {
      const attribute = attributes[j];
      const attrNameElements = attribute.getElementsByTagName('name');
      if (attrNameElements.length === 0 || getTextContent(attrNameElements[0]).trim() !== 'style') continue;

      // Check for direct value
      const valueElements = attribute.getElementsByTagName('value');
      for (let k = 0; k < valueElements.length; k++) {
        const markerName = getTextContent(valueElements[k]).trim();
        if (markerName) {
          if (markersMap.markers[markerName] && markersMap.markers[markerName].type !== markerType) {
            console.error(`Error: Marker name "${markerName}" has conflicting types:`);
            console.error(`  Existing type: "${markersMap.markers[markerName].type}"`);
            console.error(`  Conflicting type: "${markerType}"`);
            console.error(`  In definition: "${defineName}"`);
            process.exit(1);
          }
          markersMap.markers[markerName] = { type: markerType };
        }
      }

      // Check for referenced enum
      const refElements = attribute.getElementsByTagName('ref');
      for (let k = 0; k < refElements.length; k++) {
        const refName = refElements[k].getAttribute('name');
        if (refName) {
          // Find the referenced definition
          const refDefines = doc.getElementsByTagName('define');
          for (let l = 0; l < refDefines.length; l++) {
            const refDefine = refDefines[l];
            if (refDefine.getAttribute('name') === refName) {
              const choiceElements = refDefine.getElementsByTagName('choice');
              for (let m = 0; m < choiceElements.length; m++) {
                const choice = choiceElements[m];
                const refValueElements = choice.getElementsByTagName('value');
                for (let n = 0; n < refValueElements.length; n++) {
                  const markerName = getTextContent(refValueElements[n]).trim();
                  if (markerName) {
                    if (markersMap.markers[markerName] && markersMap.markers[markerName].type !== markerType) {
                      console.error(`Error: Marker name "${markerName}" has conflicting types:`);
                      console.error(`  Existing type: "${markersMap.markers[markerName].type}"`);
                      console.error(`  Conflicting type: "${markerType}"`);
                      console.error(`  In definition: "${defineName}"`);
                      process.exit(1);
                    }
                    markersMap.markers[markerName] = { type: markerType };
                  }
                }
              }
              break;
            }
          }
        }
      }
    }
  }

  // Track skipped definitions that have values but no style attributes
  const hasValues = defineElement.getElementsByTagName('value').length > 0;
  const hasStyleAttr = Array.from(defineElement.getElementsByTagName('attribute')).some(attr => {
    const nameElements = attr.getElementsByTagName('name');
    return nameElements.length > 0 && getTextContent(nameElements[0]).trim() === 'style';
  });

  if (hasValues && !hasStyleAttr && !defineName.includes('.style.enum')) {
    skippedDefinitions.add(defineName);
  }
}

// Process all define elements
const defineElements = doc.getElementsByTagName('define');
for (let i = 0; i < defineElements.length; i++) {
  processDefineElement(defineElements[i]);
}

// Write the output file
fs.writeFileSync(
  'markers.json',
  JSON.stringify(markersMap, null, 2),
  'utf-8'
);

console.log('Generated markers.json successfully');
console.log('\nSkipped definitions:');
console.log(Array.from(skippedDefinitions).sort().join('\n'));
