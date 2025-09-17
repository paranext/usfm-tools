import { DOMParser } from '@xmldom/xmldom';
import {
  AttributeMarkerInfo,
  CloseableMarkerTypeInfo,
  MarkerInfo,
  MarkersMap,
  MarkerTypeInfo,
} from './markers-map.model.template';

/** Name of object representing a marker - for use in logging */
const OBJECT_TYPE_MARKER = 'Marker';
/** Name of object representing a marker type - for use in logging */
const OBJECT_TYPE_MARKER_TYPE = 'Marker type';

// #region XML helper functions

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
 * Helper function to get the first child element with the given tag name (not deep search).
 *
 * Logs a warning and just returns the first one if there are more than one matching.
 */
function getFirstChildWithTagName(element: Element, tagName: string, defineName: string) {
  const nameElements = getChildElementsByTagName(element, tagName);
  if (nameElements.length <= 0) return undefined;

  if (nameElements.length > 1) {
    console.log(
      `Warning: XML Element in definition "${defineName}" has multiple ${tagName} elements but expected one. Using the first one.`
    );
  }

  return nameElements[0];
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
    const nameElement = getFirstChildWithTagName(element, 'name', defineName);
    if (nameElement) name = getTextContent(nameElement);
  }

  return name;
}

/** Get the associated `define` element for a ref */
function getDefineElementForRef(
  refName: string,
  defineElements: Array<Element>,
  defineName: string
): Element | undefined {
  // Find the referenced definition
  for (let l = 0; l < defineElements.length; l++) {
    const refDefine = defineElements[l];
    if (refDefine.getAttribute('name') !== refName) continue;

    return refDefine;
  }
  console.log(
    `Warning: Could not find referenced definition "${refName}" in definition "${defineName}". Skipping.`
  );
  return undefined;
}

// #endregion XML helper functions

// #region object merging functions

/**
 * Log an error that something went wrong while merging two objects
 *
 * @param objectType type of object e.g. "marker"
 * @param objectName name of object e.g. "esb"
 * @param propertyName name of property that had the conflict e.g. "default attribute"
 * @param defineName name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingValue existing property value
 * @param newValue new property value that is causing the conflict
 */
function logObjectMergeConflictError(
  objectType: string,
  objectName: string,
  propertyName: string,
  defineName: string,
  existingValue: unknown,
  newValue: unknown
) {
  console.error(`Error: ${objectType} named "${objectName}" has conflicting ${propertyName}:`);
  console.error(`  Existing ${propertyName}: ${JSON.stringify(existingValue)}`);
  console.error(`  Conflicting ${propertyName}: ${JSON.stringify(newValue)}`);
  console.error(`  In definition: "${defineName}"`);
}

/**
 * Log a warning while merging two objects that one object had a property and the other did not and that
 * the merge will use the present property value
 *
 * @param objectType type of object e.g. "marker"
 * @param objectName name of object e.g. "esb"
 * @param propertyName name of property that had the conflict e.g. "default attribute"
 * @param defineName name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingValue existing property value
 * @param newValue new value for the property
 */
function logObjectUseOnePropertyWarning(
  objectType: string,
  objectName: string,
  propertyName: string,
  defineName: string,
  existingValue: unknown,
  newValue: unknown
) {
  console.log(
    `Warning: ${objectType} named "${objectName}" has one definition with a ${
      propertyName
    } and one without: ${JSON.stringify(existingValue)}, ${JSON.stringify(
      newValue
    )}. Using the one with the ${propertyName}. In definition: ${defineName}`
  );
}

/**
 * Verify that, of two strings, at most one is defined.
 *
 * This confirms that the strings can be merged using `{ ...a, ...b }` without conflicts.
 *
 * @param objectType type of object e.g. "marker"
 * @param objectName name of object e.g. "esb"
 * @param propertyName name of property that is being merged e.g. "default attribute"
 * @param defineName name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingString existing string
 * @param newString new string to merge into the existing string
 */
function verifyStringsCanBeMerged(
  objectType: string,
  objectName: string,
  propertyName: string,
  defineName: string,
  existingString: string | undefined,
  newString: string | undefined
) {
  if (existingString === newString) return;

  // If both strings are defined but don't match, that's an error
  if (existingString && newString) {
    logObjectMergeConflictError(
      objectType,
      objectName,
      propertyName,
      defineName,
      existingString,
      newString
    );
    process.exit(1);
  }

  // One is defined, so just log a warning
  logObjectUseOnePropertyWarning(
    objectType,
    objectName,
    propertyName,
    defineName,
    existingString,
    newString
  );
}

/**
 * Merge two arrays, combining and deduplicating contents. Returns a new array if the merge changed
 * anything; does not modify the original arrays
 *
 * @param objectType type of object e.g. "marker"
 * @param objectName name of object e.g. "esb"
 * @param propertyName name of property that is being merged e.g. "default attribute"
 * @param defineName name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingArray existing array
 * @param newArray new array to merge into the existing array
 * @returns array with merged contents or `undefined` if there was no array
 */
function mergeArrays<T>(
  objectType: string,
  objectName: string,
  propertyName: string,
  defineName: string,
  existingArray: Array<T> | undefined,
  newArray: Array<T> | undefined
) {
  // If both are undefined, do nothing
  if (!existingArray && !newArray) return undefined;

  // If one is defined, log a warning and use it
  if (!existingArray || !newArray) {
    logObjectUseOnePropertyWarning(
      objectType,
      objectName,
      propertyName,
      defineName,
      existingArray,
      newArray
    );
    return undefined;
  }
  // If the arrays are equal, return one
  if (
    existingArray.length === newArray.length &&
    !existingArray.some(attributeA => !newArray.includes(attributeA))
  )
    return existingArray;

  // Both arrays are defined but don't match, so combine them
  console.log(
    `Warning: ${objectType} named "${
      objectName
    }" has two definitions with ${propertyName} arrays of different lengths: ${JSON.stringify(
      existingArray
    )}, ${JSON.stringify(newArray)}. Combining them. In definition: ${defineName}`
  );

  // Combine the arrays, keeping only unique values
  return Array.from(new Set([...existingArray, ...newArray]));
}

/**
 * Verify that two markers with the same name are similar enough that they can merge, then merge them
 *
 * @param markerA Existing marker info
 * @param markerB New marker info
 * @param markerName Name of marker being compared (for error messages)
 * @param defineName Name of definition adding the new marker (for error messages)
 * @returns merged marker info with markerA properties combined with markerB properties
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

  // Create the merged marker so we can edit the properties without modifying the original markers
  const mergedMarker = { ...markerA, ...markerB };

  // If types don't match, that's always an error
  if (markerA.type !== markerB.type) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER,
      markerName,
      'type',
      defineName,
      markerA.type,
      markerB.type
    );
    process.exit(1);
  }

  // Check defaultAttribute can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerName,
    'defaultAttribute',
    defineName,
    markerA.defaultAttribute,
    markerB.defaultAttribute
  );

  // Combine attributeMarkers
  const mergedAttributeMarkers = mergeArrays(
    OBJECT_TYPE_MARKER,
    markerName,
    'attributeMarkers',
    defineName,
    markerA.attributeMarkers,
    markerB.attributeMarkers
  );
  if (mergedAttributeMarkers) mergedMarker.attributeMarkers = mergedAttributeMarkers;

  // Combine isAttributeMarkerFor
  // We will do some merging assuming these properties are here. We always handle if the properties
  // are not present, so it is not a problem
  const attributeMarkerA = markerA as AttributeMarkerInfo;
  const attributeMarkerB = markerB as AttributeMarkerInfo;
  const attributeMergedMarker = mergedMarker as AttributeMarkerInfo;

  const mergedIsAttributeMarkerFor = mergeArrays(
    OBJECT_TYPE_MARKER,
    markerName,
    'isAttributeMarkerFor',
    defineName,
    attributeMarkerA.isAttributeMarkerFor,
    attributeMarkerB.isAttributeMarkerFor
  );
  if (mergedIsAttributeMarkerFor)
    attributeMergedMarker.isAttributeMarkerFor = mergedIsAttributeMarkerFor;

  // Check attributeMarkerAttributeName can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerName,
    'attributeMarkerAttributeName',
    defineName,
    attributeMarkerA.attributeMarkerAttributeName,
    attributeMarkerB.attributeMarkerAttributeName
  );

  return mergedMarker;
}

/**
 * Verify that two marker types with the same name are similar enough that they can merge, then merge them
 *
 * @param markerTypeA Existing marker type info
 * @param markerTypeB New marker type info
 * @param markerTypeName Name of marker type being compared (for error messages)
 * @param defineName Name of definition adding the new marker type (for error messages)
 * @returns merged marker type info with markerTypeA properties combined with markerTypeB properties
 */
function mergeMarkerTypes(
  markerTypeA: MarkerTypeInfo | undefined,
  markerTypeB: MarkerTypeInfo,
  markerTypeName: string,
  defineName: string
) {
  // If only one exists, nothing to verify
  if (!markerTypeA) return markerTypeB;

  // Both exist, so verify they are compatible

  // Create the merged marker type so we can edit the properties without modifying the original marker types
  const mergedMarkerType = { ...markerTypeA, ...markerTypeB };

  // If booleans don't match, that's always an error (note we are assuming not present means `false`
  // even though that is not necessarily the case. Assuming the boolean won't be present if it matches
  // the default value. We can change this later if needed)
  if (markerTypeA.hasStyleAttribute !== markerTypeB.hasStyleAttribute) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'hasStyleAttribute',
      defineName,
      markerTypeA.hasStyleAttribute,
      markerTypeB.hasStyleAttribute
    );
    process.exit(1);
  }
  if (markerTypeA.requiresNewlineBefore !== markerTypeB.requiresNewlineBefore) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'requiresNewlineBefore',
      defineName,
      markerTypeA.requiresNewlineBefore,
      markerTypeB.requiresNewlineBefore
    );
    process.exit(1);
  }
  if (markerTypeA.hasClosingMarker !== markerTypeB.hasClosingMarker) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'hasClosingMarker',
      defineName,
      markerTypeA.hasClosingMarker,
      markerTypeB.hasClosingMarker
    );
    process.exit(1);
  }

  // Combine skipOutputAttributeToUsfm
  const mergedSkipOutputAttributeToUsfm = mergeArrays(
    OBJECT_TYPE_MARKER_TYPE,
    markerTypeName,
    'skipOutputAttributeToUsfm',
    defineName,
    markerTypeA.skipOutputAttributeToUsfm,
    markerTypeB.skipOutputAttributeToUsfm
  );
  if (mergedSkipOutputAttributeToUsfm)
    mergedMarkerType.skipOutputAttributeToUsfm = mergedSkipOutputAttributeToUsfm;

  // Combine skipOutputMarkerToUsfmIfAttributeIsPresent
  const mergedSkipOutputMarkerToUsfmIfAttributeIsPresent = mergeArrays(
    OBJECT_TYPE_MARKER_TYPE,
    markerTypeName,
    'skipOutputMarkerToUsfmIfAttributeIsPresent',
    defineName,
    markerTypeA.skipOutputMarkerToUsfmIfAttributeIsPresent,
    markerTypeB.skipOutputMarkerToUsfmIfAttributeIsPresent
  );
  if (mergedSkipOutputMarkerToUsfmIfAttributeIsPresent)
    mergedMarkerType.skipOutputMarkerToUsfmIfAttributeIsPresent =
      mergedSkipOutputMarkerToUsfmIfAttributeIsPresent;

  // We will do some merging assuming these properties are here. We always handle if the properties
  // are not present, so it is not a problem
  const closeableMarkerTypeA = markerTypeA as CloseableMarkerTypeInfo;
  const closeableMarkerTypeB = markerTypeB as CloseableMarkerTypeInfo;

  // If booleans don't match, that's always an error (note we are assuming not present means `false`
  // even though that is not necessarily the case. Assuming the boolean won't be present if it matches
  // the default value. We can change this later if needed)
  if (
    closeableMarkerTypeA.isClosingMarkerOptional !== closeableMarkerTypeB.isClosingMarkerOptional
  ) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'isClosingMarkerOptional',
      defineName,
      closeableMarkerTypeA.isClosingMarkerOptional,
      closeableMarkerTypeB.isClosingMarkerOptional
    );
    process.exit(1);
  }
  if (closeableMarkerTypeA.isClosingMarkerEmpty !== closeableMarkerTypeB.isClosingMarkerEmpty) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'isClosingMarkerEmpty',
      defineName,
      closeableMarkerTypeA.isClosingMarkerEmpty,
      closeableMarkerTypeB.isClosingMarkerEmpty
    );
    process.exit(1);
  }

  return mergedMarkerType;
}

// #endregion object merging functions

// #region processing usx.rng data

/**
 * Create a list of all USFM-style (not XML) attributes for the marker an element represents. Also gather
 * some preliminary information about those attributes.
 *
 * These attributes are children of the element and attributes found in refs in the element.
 *
 * The information returned alongside the attributes in this function is only the information about attributes
 * that is gathered differently based on if the attribute is a child of the element or if the attribute is
 * found through a ref in the element.
 *
 * @param element the XML element that represents the marker being processed
 * @param markerType type of the marker being processed
 * @param defineElements The collection of all define elements (for reference lookups)
 * @param defineName Name of `define` containing this `element` (for error messages)
 * @returns array of objects containing the attribute and some preliminary info about that attribute
 */
function collectAttributesForElement(
  element: Element,
  markerType: string,
  defineElements: Array<Element>,
  defineName: string
) {
  // Make a list of attribute elements to process along with some info we need to determine
  // based on if the attribute is a child or in a ref
  // These attributes are children of the element and attributes found in refs in the element
  const elementAttributes: {
    attribute: Element;
    // We already got attribute name, so might as well include it
    attributeName: string;
    // ref may be inside optional, so we determine isOptional differently between the two kinds
    isOptional?: boolean;
    // ref may have usfm:ignore on it, so determine skipOutputToUsfm differently between the two
    skipOutputToUsfm?: boolean;
  }[] = [];

  // Look through child attributes of the element
  const childAttributes = element.getElementsByTagName('attribute');
  for (let j = 0; j < childAttributes.length; j++) {
    const attribute = childAttributes[j];

    const attributeName = getElementName(attribute, defineName);
    if (!attributeName) continue;

    // Make sure this style attribute is a child of this element, not of a nested element
    // Also check if attribute is inside an optional element
    let isOptional = false;
    let parent = attribute.parentNode;
    while (parent && parent !== element) {
      if (parent.nodeName === 'element') break; // Found the closest parent element, so we're done searching

      if (parent.nodeName === 'optional') isOptional = true;

      parent = parent.parentNode;
    }
    // If the closest parent element is not the element we are processing, skip this attribute
    if (parent !== element) continue;

    elementAttributes.push({ attribute, attributeName, isOptional });
  }

  // Look through direct child refs or refs that are under `optional` tags for attributes
  const refs = element.getElementsByTagName('ref');
  for (let j = 0; j < refs.length; j++) {
    const ref = refs[j];

    const refName = ref.getAttribute('name');
    if (!refName) {
      console.log(
        `Warning: Found ref element without a name attribute in marker type ${markerType} in definition "${defineName}". Skipping.`
      );
      continue;
    }

    // Check to make sure this ref is a direct child or a child of an optional of the element.
    // If not, skip it
    let isRefOptional = false;
    let parent = ref.parentNode;
    if (!parent) continue;
    if (parent.nodeName === 'optional') {
      isRefOptional = true;
      parent = parent.parentNode;
      if (!parent) continue;
    }
    if (parent !== element) continue;

    // If the attribute pointed to by this ref should be ignored when output to usfm,
    // indicate so
    // ref may have `usfm:ignore="true"` directly on it
    const skipOutputToUsfm = ref.getAttribute('usfm:ignore') === 'true';

    // Get the define element linked from this ref
    const refDefine = getDefineElementForRef(refName, defineElements, defineName);
    if (refDefine) {
      // Find attributes that are direct children or child of an optional of the define
      const attributes = refDefine.getElementsByTagName('attribute');
      for (let j = 0; j < attributes.length; j++) {
        const attribute = attributes[j];

        const attributeName = getElementName(attribute, defineName);
        if (!attributeName) continue;

        // Skip if not a direct child or child of optional of the define
        // Should be optional if it is in an optional or if the ref was optional
        let isOptional = isRefOptional;
        let parent = attribute.parentNode;
        if (!parent) continue;
        if (parent.nodeName === 'optional') {
          isOptional = true;
          parent = parent.parentNode;
          if (!parent) continue;
        }
        if (parent !== refDefine) continue;

        elementAttributes.push({ attribute, attributeName, isOptional, skipOutputToUsfm });
      }
    }
  }

  return elementAttributes;
}

/**
 * Process a define element to extract marker information
 *
 * @param defineElement The define element to process
 * @param defineElements The collection of all define elements (for reference lookups)
 * @param markersMap The markers map to populate
 * @param skippedDefinitions Set to populate with names of definitions that were skipped
 * @param skipOutputMarkerToUsfmDefineNames array of names of `define` elements whose marker
 * definitions describe markers that should not be exported to USFM (e.g. which attributes
 * indicate that the marker should not be exported to USFM)
 */
function processDefineElement(
  defineElement: Element,
  defineElements: Array<Element>,
  markersMap: MarkersMap,
  skippedDefinitions: Set<string>,
  skipOutputMarkerToUsfmDefineNames: Set<string>
) {
  const defineName = defineElement.getAttribute('name');
  if (!defineName) {
    console.log('Warning: Found define element without a name attribute. Skipping');
    return;
  }

  const skipOutputMarkerToUsfm = skipOutputMarkerToUsfmDefineNames.has(defineName);

  const elements = defineElement.getElementsByTagName('element');
  // Track whether this `define` influenced the markers map so we can record skipped `define`s
  let didChangeMarkersMap = false;

  // Process all elements in this definition
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    // Get the marker type from the element's name
    const markerType = getElementName(element, defineName);

    if (!markerType) {
      console.log(`Warning: Element in definition "${defineName}" has an empty name. Skipping.`);
      continue;
    }

    // Compile maps of markers and a type to add for this element so we can set the default attribute if
    // we find an element-wide default attribute before adding the markers to the main map
    const markersToAdd: Record<string, MarkerInfo> = {};
    const markersRegExpToAdd: Record<string, MarkerInfo> = {};
    const markerTypeToAdd: MarkerTypeInfo = {};

    // Look for style attribute to get marker names
    let hasStyle = false;
    const attributes = element.getElementsByTagName('attribute');
    for (let j = 0; j < attributes.length; j++) {
      const attribute = attributes[j];

      // Get the attribute name
      const attributeName = getElementName(attribute, defineName);

      // This attribute is not the style attribute
      if (!attributeName || attributeName !== 'style') continue;

      // Make sure this style attribute is a child of this element, not of a nested element
      let parent = attribute.parentNode;
      while (parent && parent !== element) {
        // Found the closest parent element, so we're done searching
        if (parent.nodeName === 'element') break;

        parent = parent.parentNode;
      }
      // If the closest parent element is not the element we are processing, skip this attribute
      if (parent !== element) continue;

      const styleAttribute = attribute;
      hasStyle = true;

      // Collect all value elements and param pattern elements under style and under the referenced enums
      // Start with value elements under style
      const styleValueElements = Array.from(styleAttribute.getElementsByTagName('value'));
      // Start with param pattern elements under style
      const styleParamPatternElements = Array.from(
        styleAttribute.getElementsByTagName('param')
      ).filter(param => param.getAttribute('name') === 'pattern');

      // Add in the value elements under ref elements. Ref elements may be multiple levels deep

      // List of all ref elements we are searching
      const styleRefElements = Array.from(styleAttribute.getElementsByTagName('ref'));
      let styleRefElementsIndex = 0;
      // Process all ref elements, including any new ones we find in referenced definitions
      while (styleRefElementsIndex < styleRefElements.length) {
        const refName = styleRefElements[styleRefElementsIndex].getAttribute('name');
        styleRefElementsIndex++;

        if (!refName) {
          console.log(
            `Warning: Found ref element without a name attribute in definition "${defineName}". Skipping.`
          );
          continue;
        }

        // Find the referenced definition
        const refDefine = getDefineElementForRef(refName, defineElements, defineName);
        if (refDefine) {
          // Found the ref! Get its values and be done
          styleValueElements.push(...Array.from(refDefine.getElementsByTagName('value')));
          styleParamPatternElements.push(
            ...Array.from(refDefine.getElementsByTagName('param')).filter(
              param => param.getAttribute('name') === 'pattern'
            )
          );
          // Also add unique new ref elements to the list to process
          const newRefElements = Array.from(refDefine.getElementsByTagName('ref')).filter(
            newRefElement =>
              !styleRefElements.some(
                styleRefElement =>
                  styleRefElement.getAttribute('name') === newRefElement.getAttribute('name')
              )
          );
          styleRefElements.push(...newRefElements);
        }
      }

      if (styleValueElements.length === 0 && styleParamPatternElements.length === 0) {
        console.log(
          `Warning: Style attribute in definition "${defineName}" has no value or param pattern elements. Skipping.`
        );
        continue;
      }

      // Get marker names from value elements in the style attribute
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

      // Get marker names from param pattern elements in the style attribute
      for (let k = 0; k < styleParamPatternElements.length; k++) {
        const styleParamPatternElement = styleParamPatternElements[k];
        const markerNameRegExp = getTextContent(styleParamPatternElement);
        if (markerNameRegExp) {
          const markerInfo: MarkerInfo = { type: markerType };

          // Sometimes, defaultAttribute is specified on the param pattern element
          const defaultAttribute = styleParamPatternElement.getAttribute('usfm:propval');
          if (defaultAttribute) {
            markerInfo.defaultAttribute = defaultAttribute;
          }

          markersRegExpToAdd[markerNameRegExp] = mergeMarkers(
            markersRegExpToAdd[markerNameRegExp],
            markerInfo,
            markerNameRegExp,
            defineName
          );
        }
      }
    }

    // If the element doesn't have a style attribute and if this `define` indicates the marker
    // should not be skipped for USFM, its element name (markerType) represents a marker
    if (!hasStyle && !skipOutputMarkerToUsfm) {
      const markerName = markerType;
      const markerInfo: MarkerInfo = { type: markerType };

      markersToAdd[markerName] = mergeMarkers(
        markersToAdd[markerName],
        markerInfo,
        markerName,
        defineName
      );

      markerTypeToAdd.hasStyleAttribute = false;
    }

    const didCreateMarker =
      Object.entries(markersToAdd).length > 0 || Object.entries(markersRegExpToAdd).length > 0;
    didChangeMarkersMap = didCreateMarker;
    // If this `define` created a marker or may to edit an existing marker type based on the
    // attributes, figure out element-level attribute information, then add all collected marker
    // info to the main markers map
    if (didCreateMarker || skipOutputMarkerToUsfm) {
      // Gather all the attributes on the element and some information about them
      const elementAttributes = collectAttributesForElement(
        element,
        markerType,
        defineElements,
        defineName
      );

      // Process all found attributes and build up additional marker info to put on each marker for this
      // marker type
      const extraMarkerInfo: Partial<MarkerInfo> = {};

      // Track the first non-optional non-skipped attributes so we can get default attribute
      let nonOptionalCount = 0;
      let firstRequiredNonSkippedAttribute: string | undefined;
      let firstOptionalNonSkippedAttribute: string | undefined;

      // Loop through all attributes and determine some characteristics
      for (let j = 0; j < elementAttributes.length; j++) {
        const { attribute, attributeName, isOptional } = elementAttributes[j];
        // We did some computation on skipOutputToUsfm for when the attribute is through a ref,
        // but we need to do more to determine if we should skip outputting this attribute to USFM
        // As such, this is just a `let` so we can modify it
        let { skipOutputToUsfm } = elementAttributes[j];

        // Determine if we should manually skip this attribute
        // Always skip style attribute because it is not like other attributes and should not
        // be considered in this area
        if (attributeName === 'style') continue;
        // Exception case - always skip closed attribute for now because it's a really weird
        // attribute that we have to do manual things with. Maybe we will handle this better
        // in the future
        if (attributeName === 'closed') continue;
        // Exception case - `colspan` is an attribute that gets incorporated into the marker
        // name. But it isn't marked in any specialway in `usx.rng`. And we're not handling
        // tables yet anyway. Just skip this attribute until something changes.
        if (markerType === 'cell' && attributeName === 'colspan') continue;

        const usfmMatchElements = getChildElementsByTagName(attribute, 'usfm:match');
        if (usfmMatchElements.length > 1)
          console.log(
            `Warning: Attribute ${attributeName} on marker type ${
              markerType
            } has multiple usfm:match tags. It will not be considered for special attribute properties like leading attribute. In define ${
              defineName
            }`
          );

        // If this `define` is a marker that should not be output to USFM, put this attribute in the
        // list of marker skip attributes and continue to the next attribute
        if (skipOutputMarkerToUsfm) {
          if (!markerTypeToAdd.skipOutputMarkerToUsfmIfAttributeIsPresent)
            markerTypeToAdd.skipOutputMarkerToUsfmIfAttributeIsPresent = [];
          markerTypeToAdd.skipOutputMarkerToUsfmIfAttributeIsPresent.push(attributeName);
          didChangeMarkersMap = true;
          continue;
        }

        // If this attribute should be ignored when output to usfm, indicate so
        // Skip output attribute may have `usfm:ignore="true"` directly on it
        if (!skipOutputToUsfm) skipOutputToUsfm = attribute.getAttribute('usfm:ignore') === 'true';
        // Skip output attribute may have `usfm:match` with `noout="true"`
        if (!skipOutputToUsfm) {
          skipOutputToUsfm = usfmMatchElements.some(
            usfmMatch => usfmMatch.getAttribute('noout') === 'true'
          );
        }
        // Skip output attribute may have child `name` element with `ns` attribute not empty
        if (!skipOutputToUsfm) {
          const nameElement = getFirstChildWithTagName(attribute, 'name', defineName);
          if (nameElement && nameElement.getAttribute('ns')) skipOutputToUsfm = true;
        }

        // Some exception cases for skipping output to USFM - I think these are errors in `usx.rng`
        // If the errors are fixed, these should be removed
        if ((markerType === 'para' || markerType === 'table') && attributeName === 'vid')
          skipOutputToUsfm = true;
        else if (markerType === 'chapter' && attributeName === 'sid') skipOutputToUsfm = true;
        else if (markerType === 'cell' && attributeName === 'align') skipOutputToUsfm = true;

        // If we should skip this attribute, add it to the skipped list on the marker type
        if (skipOutputToUsfm) {
          if (!markerTypeToAdd.skipOutputAttributeToUsfm)
            markerTypeToAdd.skipOutputAttributeToUsfm = [];
          markerTypeToAdd.skipOutputAttributeToUsfm.push(attributeName);
        }

        // Determine if this attribute is hard-coded not to be a default attribute
        const isNotDefaultAttribute = usfmMatchElements.some(usfmMatchElement =>
          usfmMatchElement.getAttribute('beforeout')?.includes(`|${attributeName}=`)
        );

        // Determine first required/optional attribute to figure out default attribute
        // Don't factor in attributes that:
        // - should be skipped when outputting to usfm
        // - are specifically not default attributes
        if (!skipOutputToUsfm && !isNotDefaultAttribute) {
          if (!isOptional) {
            nonOptionalCount++;
            if (!firstRequiredNonSkippedAttribute) {
              firstRequiredNonSkippedAttribute = attributeName;
            }
          } else if (!firstOptionalNonSkippedAttribute) {
            firstOptionalNonSkippedAttribute = attributeName;
          }
        }
      }

      // Figure out default attribute
      // Find the first non-optional non-skipped attribute or, if there are no non-optional attributes,
      // the first non-skipped attribute to consider to be the default attribute
      // If there's exactly one non-optional attribute, use it as the default
      if (nonOptionalCount === 1) {
        extraMarkerInfo.defaultAttribute = firstRequiredNonSkippedAttribute;
      }
      // If there are no non-optional attributes, use the first optional attribute
      else if (nonOptionalCount === 0 && firstOptionalNonSkippedAttribute) {
        extraMarkerInfo.defaultAttribute = firstOptionalNonSkippedAttribute;
      }

      // Done collecting additional marker information from attributes. Now,
      // Add all collected markers to the main markers map, applying the extra marker info
      for (const [markerName, markerInfo] of Object.entries(markersToAdd)) {
        // Add extra marker info to each marker we found in the element
        const updatedMarkerInfo =
          Object.keys(extraMarkerInfo).length > 0
            ? mergeMarkers(
                markerInfo,
                { ...markerInfo, ...extraMarkerInfo },
                markerName,
                defineName
              )
            : markerInfo;

        markersMap.markers[markerName] = mergeMarkers(
          markersMap.markers[markerName],
          updatedMarkerInfo,
          markerName,
          defineName
        );
      }
      for (const [markerName, markerInfo] of Object.entries(markersRegExpToAdd)) {
        // Add extra marker info to each marker we found in the element
        const updatedMarkerInfo =
          Object.keys(extraMarkerInfo).length > 0
            ? mergeMarkers(
                markerInfo,
                { ...markerInfo, ...extraMarkerInfo },
                markerName,
                defineName
              )
            : markerInfo;

        markersMap.markersRegExp[markerName] = mergeMarkers(
          markersMap.markersRegExp[markerName],
          updatedMarkerInfo,
          markerName,
          defineName
        );
      }

      // Add the marker type to the main markers map
      if (!didCreateMarker && skipOutputMarkerToUsfm && !markersMap.markerTypes[markerType]) {
        // This isn't necessarily a problem, but it's easier to make sure we don't add any fake marker
        // types that don't have real markers associated with them if we assume the modifications to
        // existing marker types will always come after those marker types are defined. Can always
        // come back and fix this later if we encounter a problem
        console.log(
          `Tried adding skipOutputMarkerToUsfmIfAttributeIsPresent to marker type ${
            markerType
          } that doesn't already exist! In ${defineName}`
        );
        process.exit(1);
      }
      markersMap.markerTypes[markerType] = mergeMarkerTypes(
        markersMap.markerTypes[markerType],
        markerTypeToAdd,
        markerType,
        defineName
      );
    }
  }

  // If this definition didn't create any markers, add it to skipped
  if (!didChangeMarkersMap) {
    skippedDefinitions.add(defineName);
  }
}

// #endregion processing usx.rng data

/**
 * Transform a USX RelaxNG schema into a markers map
 *
 * @param usxSchema USX RelaxNG schema
 * @param version Which USX version this schema represents
 * @param commit Commit hash of the USX schema file
 * @param skippedDefinitions Optional set to populate with names of definitions that did not result in
 * adding any markers to the map. This Set is transformed in place and is not returned
 * @returns The generated markers map
 */
export function transformUsxSchemaToMarkersMap(
  usxSchema: string,
  version: string,
  commit: string,
  skippedDefinitions: Set<string> = new Set<string>()
): MarkersMap {
  const parser = new DOMParser();
  const doc = parser.parseFromString(usxSchema, 'text/xml');

  const markersMap: MarkersMap = {
    version,
    commit,
    markers: {},
    markersRegExp: {},
    markerTypes: {},
  };

  // Get all define elements
  const defineElements = Array.from(doc.getElementsByTagName('define'));

  // Determine which definitions should be skipped entirely (if all `ref`s pointing to it are
  // only pointing via `usfm:alt`)
  const refElements = doc.getElementsByTagName('ref');
  // Set of define names that are referred to in `ref` `name`
  const referredDefines = new Set<string>();
  // Set of define names that are referred to in `ref` `usfm:alt`
  const referredAltDefines = new Set<string>();
  // Set of define names that have `usfm:ignore` on all `ref`s pointing to them
  const referredIgnoreDefines = new Set<string>();
  // Set of define names that do not have `usfm:ignore` on at least one `ref` pointing to them
  const referredNonIgnoreDefines = new Set<string>();
  for (let i = 0; i < refElements.length; i++) {
    const refElement = refElements[i];
    const referredName = refElement.getAttribute('name');
    if (referredName) referredDefines.add(referredName);

    const referredAltName = refElement.getAttribute('usfm:alt');
    if (referredAltName) referredAltDefines.add(referredAltName);

    // if this ref is ignored, add it to the ignored defines if it hasn't already been added
    // to the non-ignored defines
    const ignored = refElement.getAttribute('usfm:ignore') === 'true';

    // Let's assume usfm:ignore only applies to `name` because it makes no sense to be ignored alt
    if (ignored && referredAltName) {
      console.log(
        `Found a ref tag with both usfm:alt ${
          referredAltName
        } and usfm:ignore true. name ${referredName}. Doesn't make sense`
      );
      process.exit(1);
    }

    if (referredName) {
      if (ignored) {
        if (!referredNonIgnoreDefines.has(referredName)) referredIgnoreDefines.add(referredName);
        else referredIgnoreDefines.delete(referredName);
      } else {
        // This ref is not ignored. Record that it is not *always* ignored in every ref
        referredNonIgnoreDefines.add(referredName);
        referredIgnoreDefines.delete(referredName);
      }
    }
  }
  // Filter out all the `usfm:alt` referrals that are also referred to by `name`
  const referredDefinesAltOnly = Array.from(referredAltDefines).filter(
    referredNameAlt => !referredDefines.has(referredNameAlt)
  );
  // Remove all `usfm:alt`-only defines from consideration
  referredDefinesAltOnly.forEach(referredAltName => {
    const referredDefineElementIndex = defineElements.findIndex(
      defineElement => defineElement.getAttribute('name') === referredAltName
    );
    if (referredDefineElementIndex < 0) {
      console.log(
        `Could not find define element with name ${
          referredAltName
        } to remove it from the list of define elements to consider.`
      );
      return;
    }
    skippedDefinitions.add(referredAltName);
    defineElements.splice(referredDefineElementIndex, 1);
  });

  // Set some specific exceptions for 3.0.x because it doesn't have some info present in 3.1
  // TODO: set these in a smarter way once we have a better system for adding 3.1 info to 3.0.x
  if (version < '3.1' || version === 'master') {
    referredIgnoreDefines.add('ChapterEnd');
    referredIgnoreDefines.add('VerseEnd');
  }

  // Process all define elements
  for (let i = 0; i < defineElements.length; i++) {
    processDefineElement(
      defineElements[i],
      defineElements,
      markersMap,
      skippedDefinitions,
      referredIgnoreDefines
    );
  }

  // Add the required markers that might not be in the schema
  const manualDefineName = 'added manually';
  markersMap.markers['cat'] = mergeMarkers(
    markersMap.markers['cat'],
    { type: 'char' },
    'cat',
    manualDefineName
  );
  markersMap.markers['ca'] = mergeMarkers(
    markersMap.markers['ca'],
    { type: 'char' },
    'ca',
    manualDefineName
  );
  markersMap.markers['cp'] = mergeMarkers(
    markersMap.markers['cp'],
    { type: 'para' },
    'cp',
    manualDefineName
  );
  markersMap.markers['va'] = mergeMarkers(
    markersMap.markers['va'],
    { type: 'char' },
    'va',
    manualDefineName
  );
  markersMap.markers['vp'] = mergeMarkers(
    markersMap.markers['vp'],
    { type: 'char' },
    'vp',
    manualDefineName
  );
  markersMap.markers['usfm'] = mergeMarkers(
    markersMap.markers['usfm'],
    { type: 'para' },
    'usfm',
    manualDefineName
  );
  markersMap.markers['USJ'] = mergeMarkers(
    markersMap.markers['USJ'],
    { type: 'USJ' },
    'USJ',
    manualDefineName
  );
  markersMap.markerTypes['USJ'] = mergeMarkerTypes(
    markersMap.markerTypes['USJ'],
    { hasStyleAttribute: false },
    'USJ',
    manualDefineName
  );

  // In 3.0.8, `link-href` is not set default where it should be, but we need it in a couple
  // spots. Add it in there if it's missing. It should just be `href` in 3.1+, but we will
  // trust that it is properly set in 3.1+ schemas.
  if (markersMap.markers['jmp'] && !markersMap.markers['jmp'].defaultAttribute) {
    console.log(
      'Warning: Setting default attribute for jmp to link-href because defaultAttribute was not set'
    );
    markersMap.markers['jmp'].defaultAttribute = 'link-href';
  }
  if (markersMap.markers['xt'] && !markersMap.markers['xt'].defaultAttribute) {
    console.log(
      'Warning: Setting default attribute for xt to link-href because defaultAttribute was not set'
    );
    markersMap.markers['xt'].defaultAttribute = 'link-href';
  }

  // Sort the markers and marker types
  markersMap.markers = Object.fromEntries(
    Object.entries(markersMap.markers).sort(([markerNameA], [markerNameB]) => {
      const a = markerNameA.toLowerCase();
      const b = markerNameB.toLowerCase();

      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    })
  );
  markersMap.markersRegExp = Object.fromEntries(
    Object.entries(markersMap.markersRegExp).sort(([markerNameA], [markerNameB]) => {
      const a = markerNameA.toLowerCase();
      const b = markerNameB.toLowerCase();

      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    })
  );
  markersMap.markerTypes = Object.fromEntries(
    Object.entries(markersMap.markerTypes).sort(([markerTypeA], [markerTypeB]) => {
      const a = markerTypeA.toLowerCase();
      const b = markerTypeB.toLowerCase();

      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    })
  );

  return markersMap;
}
