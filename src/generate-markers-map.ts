import { DOMParser } from '@xmldom/xmldom';
import { program } from 'commander';
import fs from 'fs';
import path from 'path';

interface MarkerInfo {
  type: string;
  defaultAttribute?: string;
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

  // Skip table-related definitions and explicitly skipped definitions
  if (defineName.includes('Table') || 
      defineName === 'cell.align.enum' || 
      defineName === 'ChapterEnd' || 
      defineName === 'VerseEnd') {
    skippedDefinitions.add(defineName);
    return;
  }

  // Skip definitions that only contain attributes and no elements
  const elements = defineElement.getElementsByTagName('element');
  if (elements.length === 0) {
    // Check if there are any attribute definitions
    if (defineElement.getElementsByTagName('attribute').length > 0) {
      skippedDefinitions.add(defineName);
      return;
    }
  }

  // Process all elements in this definition
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const nameElements = element.getElementsByTagName('name');
    if (nameElements.length === 0) continue;

    const markerType = getTextContent(nameElements[0]).trim();
    if (!markerType) continue;
    const attributes = element.getElementsByTagName('attribute');
    for (let j = 0; j < attributes.length; j++) {
      const attribute = attributes[j];
      const attrNameElements = attribute.getElementsByTagName('name');
      if (attrNameElements.length === 0 || getTextContent(attrNameElements[0]).trim() !== 'style') continue;

      // Check for direct value
      const valueElements = attribute.getElementsByTagName('value');
      for (let k = 0; k < valueElements.length; k++) {
        const valueElement = valueElements[k];
        const markerName = getTextContent(valueElement).trim();
        if (markerName) {
          const defaultAttribute = valueElement.getAttribute('usfm:propval');
          const markerInfo: MarkerInfo = { type: markerType };
          if (defaultAttribute) {
            markerInfo.defaultAttribute = defaultAttribute;
          }

          // If marker exists, check for conflicts, preferring definitions that have default attributes
          if (markersMap.markers[markerName]) {
            // If types don't match, that's always an error
            if (markersMap.markers[markerName].type !== markerType) {
              console.error(`Error: Marker name "${markerName}" has conflicting types:`);
              console.error(`  Existing type: "${markersMap.markers[markerName].type}"`);
              console.error(`  Conflicting type: "${markerType}"`);
              console.error(`  In definition: "${defineName}"`);
              process.exit(1);
            }
            
            // If either the existing or new marker has a default attribute and they're different, use the one with the attribute
            if (defaultAttribute || markersMap.markers[markerName].defaultAttribute) {
              if (defaultAttribute) {
                markersMap.markers[markerName] = markerInfo;
              }
            }
          } else {
            markersMap.markers[markerName] = markerInfo;
          }
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
                  const valueElement = refValueElements[n];
                  const markerName = getTextContent(valueElement).trim();
                  if (markerName) {
                    const defaultAttribute = valueElement.getAttribute('usfm:propval');
                    const markerInfo: MarkerInfo = { type: markerType };
                    if (defaultAttribute) {
                      markerInfo.defaultAttribute = defaultAttribute;
                    }

                    // If marker exists, check for conflicts, preferring definitions that have default attributes
                    if (markersMap.markers[markerName]) {
                      // If types don't match, that's always an error
                      if (markersMap.markers[markerName].type !== markerType) {
                        console.error(`Error: Marker name "${markerName}" has conflicting types:`);
                        console.error(`  Existing type: "${markersMap.markers[markerName].type}"`);
                        console.error(`  Conflicting type: "${markerType}"`);
                        console.error(`  In definition: "${defineName}"`);
                        process.exit(1);
                      }
                      
                      // If either the existing or new marker has a default attribute and they're different, use the one with the attribute
                      if (defaultAttribute || markersMap.markers[markerName].defaultAttribute) {
                        if (defaultAttribute) {
                          markersMap.markers[markerName] = markerInfo;
                        }
                      }
                    } else {
                      markersMap.markers[markerName] = markerInfo;
                    }
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

  // If there are no style attributes, use the element name as the marker name
  const hasStyleAttr = Array.from(defineElement.getElementsByTagName('attribute')).some(attr => {
    const nameElements = attr.getElementsByTagName('name');
    return nameElements.length > 0 && getTextContent(nameElements[0]).trim() === 'style';
  });

  if (!hasStyleAttr) {
    // Get the element name
    const nameElements = defineElement.getElementsByTagName('name');
    if (nameElements.length > 0) {
      const elementName = getTextContent(nameElements[0]).trim();
      const markerType = elementName;
      const markerName = elementName;
      if (markerName) {
        // Find potential default attribute
        const attributes = defineElement.getElementsByTagName('attribute');
        let defaultAttribute: string | undefined;
        
        // Skip all attributes for certain marker types
        if (['usx', 'periph', 'chapter', 'verse'].includes(markerType)) {
          defaultAttribute = undefined;
        } else {
          // Skip specific attributes by marker type and attribute name
          const skipAttributes = new Set([
            'style', // on any marker type
          ]);

          // Add marker-type-specific skips
          if (markerType === 'book') skipAttributes.add('code');
          if (markerType === 'para' || markerType === 'table') skipAttributes.add('vid');
          if (markerType === 'note') {
            skipAttributes.add('caller');
            skipAttributes.add('category');
          }
          if (markerType === 'sidebar') skipAttributes.add('category');

          // First try to find non-optional, non-skipped attributes
          let nonOptionalCount = 0;
          let firstNonSkippedAttr: string | undefined;
          let firstOptionalNonSkippedAttr: string | undefined;
          
          for (let j = 0; j < attributes.length; j++) {
            const attr = attributes[j];
            const attrNameElements = attr.getElementsByTagName('name');
            if (attrNameElements.length === 0) continue;
            
            const attrName = getTextContent(attrNameElements[0]).trim();
            if (!skipAttributes.has(attrName)) {
              // Check if attribute is inside an optional element
              let isOptional = false;
              let parent = attr.parentNode;
              while (parent && parent !== defineElement) {
                if (parent.nodeName === 'optional') {
                  isOptional = true;
                  break;
                }
                parent = parent.parentNode;
              }
              
              if (!isOptional) {
                nonOptionalCount++;
                if (!firstNonSkippedAttr) {
                  firstNonSkippedAttr = attrName;
                }
              } else if (!firstOptionalNonSkippedAttr) {
                firstOptionalNonSkippedAttr = attrName;
              }
            }
          }

          // If there's exactly one non-optional attribute, use it as the default
          if (nonOptionalCount === 1) {
            defaultAttribute = firstNonSkippedAttr;
          } else if (nonOptionalCount === 0 && firstOptionalNonSkippedAttr) {
            defaultAttribute = firstOptionalNonSkippedAttr;
          }
        }

        // For ms marker types, 'who' takes priority if present
        if (markerType === 'ms') {
          for (let j = 0; j < attributes.length; j++) {
            const attr = attributes[j];
            const attrNameElements = attr.getElementsByTagName('name');
            if (attrNameElements.length > 0 && getTextContent(attrNameElements[0]).trim() === 'who') {
              defaultAttribute = 'who';
              break;
            }
          }
        }

        const markerInfo: MarkerInfo = { type: markerType };
        if (defaultAttribute) {
          markerInfo.defaultAttribute = defaultAttribute;
        }
        markersMap.markers[markerName] = markerInfo;
      }
    }
  }

  // Add to skipped if it's a non-enum definition that didn't produce any markers
  if (!defineName.includes('.style.enum')) {
    skippedDefinitions.add(defineName);
  }
}

// Process all define elements and track what was processed
const defineElements = doc.getElementsByTagName('define');
const allDefinitions = new Set<string>();

for (let i = 0; i < defineElements.length; i++) {
  const defineName = defineElements[i].getAttribute('name');
  if (defineName) {
    allDefinitions.add(defineName);
  }
  processDefineElement(defineElements[i]);
}

// Add any definitions that weren't explicitly skipped but also didn't generate any markers
const processedDefinitions = new Set<string>();
Object.keys(markersMap.markers).forEach((markerName) => {
  // Mark the definition that produced this marker as processed
  for (let i = 0; i < defineElements.length; i++) {
    const defineName = defineElements[i].getAttribute('name');
    if (defineName && defineElements[i].textContent?.includes(markerName)) {
      processedDefinitions.add(defineName);
    }
  }
});

// Add any unprocessed definitions to skipped
allDefinitions.forEach((defineName) => {
  if (!processedDefinitions.has(defineName) && !defineName.includes('.style.enum')) {
    skippedDefinitions.add(defineName);
  }
});

// Add the required cat marker that might not be in the schema
markersMap.markers['cat'] = { type: 'char' };

// Write the output file
fs.writeFileSync(
  'markers.json',
  JSON.stringify(markersMap, null, 2),
  'utf-8'
);

console.log('Generated markers.json successfully');
console.log('\nSkipped definitions:');
console.log(Array.from(skippedDefinitions).sort().join('\n'));
