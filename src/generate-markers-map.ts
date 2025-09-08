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

// Track which definitions are skipped
const skippedDefinitions = new Set<string>();

/** Helper function to get text content of an element */
function getTextContent(element: Element): string {
  return (element.textContent || '').trim();
}

/** Helper function to get child elements by tag name (not deep search) */
function getChildElementsByTagName(parent: Element, tagName: string): Element[] {
  const elements: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    // Child is not an element node, so skip
    if (parent.childNodes[i].nodeType !== 1 /* Node.ELEMENT_NODE - not defined in Node.js */)
      continue;

    const child = parent.childNodes[i] as Element;
    if (child.nodeType === 1 && child.tagName.toLowerCase() === tagName.toLowerCase()) {
      elements.push(child);
    }
  }
  return elements;
}

/**
 * Helper function to get an element's name from either its attribute or its direct child name element
 * @param element The element to get the name from
 * @param defineName The name of the definition containing the element (for error messages)
 * @returns The element name or undefined if not found
 */
function getElementName(element: Element, defineName: string): string | undefined {
  let name = element.getAttribute('name') ?? undefined;
  if (!name) {
    const nameElements = getChildElementsByTagName(element, 'name');
    if (nameElements.length > 0) {
      if (nameElements.length > 1) {
        console.warn(
          `Warning: XML Element in definition "${defineName}" has multiple name elements. Using the first one for getting the element name.`
        );
      }
      name = getTextContent(nameElements[0]);
    }
  }

  return name;
}

/**
 * Verify that two markers with the same name are similar enough that they can merge, then merge them
 * @param markerA Existing marker info
 * @param markerB New marker info
 * @param markerName Name of marker being compared (for error messages)
 * @param defineName Name of definition adding the new marker (for error messages)
 * @returns merged marker info with markerA properties overridden by markerB properties
 */
function mergeMarkers(
  markerA: MarkerInfo | undefined,
  markerB: MarkerInfo,
  markerName: string,
  defineName: string
) {
  // If only one exists, nothing to verify
  if (!markerA) return markerB;

  // Both exist, so verify they are compatible
  // If types don't match, that's always an error
  if (markerA.type !== markerB.type) {
    console.error(`Error: Marker name "${markerName}" has conflicting types:`);
    console.error(`  Existing type: "${markerA.type}"`);
    console.error(`  Conflicting type: "${markerB.type}"`);
    console.error(`  In definition: "${defineName}"`);
    process.exit(1);
  }

  // If both default attributes are defined but don't match, that's an error
  if (markerA.defaultAttribute !== markerB.defaultAttribute) {
    if (markerA.defaultAttribute && markerB.defaultAttribute) {
      console.error(`Error: Marker name "${markerName}" has conflicting default attribute:`);
      console.error(`  Existing default attribute: "${markerA.defaultAttribute}"`);
      console.error(`  Conflicting default attribute: "${markerB.defaultAttribute}"`);
      console.error(`  In definition: "${defineName}"`);
      process.exit(1);
    } else {
      console.warn(
        `Warning: Marker name "${markerName}" has one definition with a default attribute and one without. Using the one with the default attribute.`
      );
    }
  }

  return { ...markerA, ...markerB };
}

/**
 * Process a define element to extract marker information
 *
 * @param defineElement The define element to process
 * @param defineElements The collection of all define elements (for reference lookups)
 */
function processDefineElement(defineElement: Element, defineElements: HTMLCollectionOf<Element>) {
  const defineName = defineElement.getAttribute('name');
  if (!defineName) {
    console.warn('Warning: Found define element without a name attribute. Skipping');
    return;
  }

  // Skip table-related definitions and explicitly skipped definitions
  if (
    defineName.includes('Table') ||
    defineName === 'cell.align.enum' ||
    defineName === 'ChapterEnd' ||
    defineName === 'VerseEnd'
  ) {
    skippedDefinitions.add(defineName);
    return;
  }

  const elements = defineElement.getElementsByTagName('element');
  let createdMarker = false;

  // Process all elements in this definition
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    // Get the marker type from the element's name
    const markerType = getElementName(element, defineName);

    if (!markerType) {
      console.warn(`Warning: Element in definition "${defineName}" has an empty name. Skipping.`);
      continue;
    }

    // Compile a map of markers to add for this element so we can set the default attribute if we find an
    // element-wide default attribute before adding the markers to the main map
    const markersToAdd: Record<string, MarkerInfo> = {};

    // Look for style attribute to get marker names
    let hasStyle = false;
    const attributes = element.getElementsByTagName('attribute');
    for (let j = 0; j < attributes.length; j++) {
      const attribute = attributes[j];

      // Get the attribute name
      const attributeName = getElementName(attribute, defineName);

      // This attribute is not the style attribute
      if (!attributeName || attributeName !== 'style') continue;

      const styleAttribute = attribute;
      hasStyle = true;

      // Collect all value elements under style and under the referenced enums
      // Start with value elements under style
      const styleValueElements = Array.from(styleAttribute.getElementsByTagName('value'));

      // Add in the value elements under ref elements. Ref elements may be multiple levels deep

      // List of all ref elements we are searching
      const styleRefElements = Array.from(styleAttribute.getElementsByTagName('ref'));
      let styleRefElementsIndex = 0;
      // Process all ref elements, including any new ones we find in referenced definitions
      while (styleRefElementsIndex < styleRefElements.length) {
        const refName = styleRefElements[styleRefElementsIndex].getAttribute('name');
        styleRefElementsIndex++;

        if (!refName) {
          console.warn(
            `Warning: Found ref element without a name attribute in definition "${defineName}". Skipping.`
          );
          continue;
        }

        // Find the referenced definition
        let foundRef = false;
        for (let l = 0; l < defineElements.length; l++) {
          const refDefine = defineElements[l];
          if (refDefine.getAttribute('name') !== refName) continue;

          // Found the ref! Get its values and be done
          styleValueElements.push(...Array.from(refDefine.getElementsByTagName('value')));
          // Also add unique new ref elements to the list to process
          const newRefElements = Array.from(refDefine.getElementsByTagName('ref')).filter(
            newRefElement =>
              !styleRefElements.some(
                styleRefElement =>
                  styleRefElement.getAttribute('name') === newRefElement.getAttribute('name')
              )
          );
          styleRefElements.push(...newRefElements);
          foundRef = true;
          break;
        }
        if (!foundRef) {
          console.warn(
            `Warning: Could not find referenced definition "${refName}" in definition "${defineName}". Skipping.`
          );
        }
      }

      // Get marker names from value elements in the style attribute
      if (styleValueElements.length === 0) {
        console.warn(
          `Warning: Style attribute in definition "${defineName}" has no value elements. Skipping.`
        );
        continue;
      }

      for (let k = 0; k < styleValueElements.length; k++) {
        const styleValueElement = styleValueElements[k];
        const markerName = getTextContent(styleValueElement);
        if (markerName) {
          const markerInfo: MarkerInfo = { type: markerType };

          // Sometimes, defaultAttribute is specified on the style value element
          const defaultAttribute = styleValueElement.getAttribute('usfm:propval');
          if (defaultAttribute) {
            markerInfo.defaultAttribute = defaultAttribute;
          }

          markersToAdd[markerName] = mergeMarkers(
            markersToAdd[markerName],
            markerInfo,
            markerName,
            defineName
          );
        }
      }
    }

    // If the element doesn't have a style attribute, its element name (markerType) represents a marker
    if (!hasStyle) {
      const markerName = markerType;
      const markerInfo: MarkerInfo = { type: markerType };

      markersToAdd[markerName] = mergeMarkers(
        markersToAdd[markerName],
        markerInfo,
        markerName,
        defineName
      );
    }

    // Add all collected markers to the main markers map
    const markersToAddEntries = Object.entries(markersToAdd);
    if (markersToAddEntries.length > 0) {
      createdMarker = true;

      // Find the first non-optional non-skipped attribute or, if there are no non-optional attributes,
      // the first non-skipped attribute to consider to be the default attribute
      // Find potential default attribute
      const attributes = element.getElementsByTagName('attribute');
      let defaultAttribute: string | undefined;

      // First try to find non-optional non-skipped attributes
      let nonOptionalCount = 0;
      let firstRequiredNonSkippedAttribute: string | undefined;
      let firstOptionalNonSkippedAttribute: string | undefined;

      for (let j = 0; j < attributes.length; j++) {
        const attribute = attributes[j];

        const attributeName = getElementName(attribute, defineName);
        if (!attributeName) continue;

        // Determine if we should skip this attribute when looking for a default attribute
        if (markerType === 'usx') continue; // Skip all attributes on usx marker type
        if (markerType === 'book' && attributeName === 'code') continue; // Skip code on book marker type
        if (markerType === 'periph') continue; // Skip all attributes on periph marker type
        if (attributeName === 'style') continue; // Always skip style attribute
        if ((markerType === 'para' || markerType === 'table') && attributeName === 'vid') continue; // Skip vid on para and table marker types
        if (markerType === 'chapter') continue; // Skip all attributes on chapter marker type
        if (markerType === 'verse') continue; // Skip all attributes on verse marker type
        if (markerType === 'note' && (attributeName === 'caller' || attributeName === 'category'))
          continue; // Skip caller and category on note marker type
        if (markerType === 'sidebar' && attributeName === 'category') continue; // Skip category on sidebar marker type

        // Check if attribute is inside an optional element
        let isOptional = false;
        let parent = attribute.parentNode;
        while (parent && parent !== element) {
          if (parent.nodeName === 'optional') {
            isOptional = true;
            break;
          }
          parent = parent.parentNode;
        }

        if (!isOptional) {
          nonOptionalCount++;
          if (!firstRequiredNonSkippedAttribute) {
            firstRequiredNonSkippedAttribute = attributeName;
          }
        } else if (!firstOptionalNonSkippedAttribute) {
          firstOptionalNonSkippedAttribute = attributeName;
        }
      }

      // If there's exactly one non-optional attribute, use it as the default
      if (nonOptionalCount === 1) {
        defaultAttribute = firstRequiredNonSkippedAttribute;
      }
      // If there are no non-optional attributes, use the first optional attribute
      else if (nonOptionalCount === 0 && firstOptionalNonSkippedAttribute) {
        defaultAttribute = firstOptionalNonSkippedAttribute;
      }

      for (const [markerName, markerInfo] of markersToAddEntries) {
        // Add default attribute to each marker we found in the element
        const updatedMarkerInfo = defaultAttribute
          ? mergeMarkers(markerInfo, { ...markerInfo, defaultAttribute }, markerName, defineName)
          : markerInfo;

        markersMap.markers[markerName] = mergeMarkers(
          markersMap.markers[markerName],
          updatedMarkerInfo,
          markerName,
          defineName
        );
      }
    }
  }

  // If this definition didn't create any markers, add it to skipped
  if (!createdMarker) {
    skippedDefinitions.add(defineName);
  }
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

// Process all define elements
const defineElements = doc.getElementsByTagName('define');

for (let i = 0; i < defineElements.length; i++) {
  processDefineElement(defineElements[i], defineElements);
}

// Add the required cat marker that might not be in the schema
markersMap.markers['cat'] = mergeMarkers(
  markersMap.markers['cat'],
  { type: 'char' },
  'cat',
  'added manually'
);

// In 3.0.8, `link-href` is not set default where it should be, but we need it in a couple
// spots. Add it in there if it's missing. It should just be `href` in 3.1+, but we will
// trust that it is properly set in 3.1+ schemas.
if (markersMap.markers['jmp'] && !markersMap.markers['jmp'].defaultAttribute) {
  console.warn(
    'Warning: Setting default attribute for jmp to link-href because defaultAttribute was not set'
  );
  markersMap.markers['jmp'].defaultAttribute = 'link-href';
}
if (markersMap.markers['xt'] && !markersMap.markers['xt'].defaultAttribute) {
  console.warn(
    'Warning: Setting default attribute for jmp to link-href because defaultAttribute was not set'
  );
  markersMap.markers['xt'].defaultAttribute = 'link-href';
}

// Write the output file
fs.writeFileSync('markers.json', JSON.stringify(markersMap, null, 2), 'utf-8');

console.log('Generated markers.json successfully');
console.log('\nSkipped definitions:');
console.log(Array.from(skippedDefinitions).sort().join('\n'));
