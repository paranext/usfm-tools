import { DOMParser } from '@xmldom/xmldom';
import {
  AttributeMarkerInfo,
  CloseableMarkerTypeInfo,
  MarkerInfo,
  MarkersMap,
  MarkerTypeInfo,
} from './markers-map.model.template';

/** Which version of the markers map we are generating */
const MARKERS_MAP_VERSION = '1.0.0';

/** Name of object representing a marker - for use in logging */
const OBJECT_TYPE_MARKER = 'Marker';
/** Name of object representing a marker type - for use in logging */
const OBJECT_TYPE_MARKER_TYPE = 'Marker type';
/**
 * RegExp to match against `usfm:match` or `usf:tag` or `usfm:ptag`'s `beforeout` to see if it has a
 * marker.
 *
 * Matches:
 *
 * - 0: the whole string
 * - 1: `\n` if there is one before the marker; `undefined` otherwise
 * - 2: the marker name
 * - 3: a space after the marker if there is one; `undefined` otherwise
 */
const BEFORE_OUT_MARKER_NAME_REGEXP = /(\\n)?\\\\(\S+)( ?)/;

/** XML node types. These are built into the browser, but they are not defined in Node.js */
enum NODE_TYPE {
  /** Node.ELEMENT_NODE */
  ELEMENT = 1,
  /** Node.COMMENT_NODE */
  COMMENT = 8,
}

// #region misc helpful functions

/** Comparison function for comparing two strings lower case culture invariant */
function compareStringsInvariantCaseInsensitive(a: string, b: string) {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower < bLower) return -1;
  if (aLower > bLower) return 1;
  return 0;
}

// #endregion misc helpful functions

// #region XML helper functions

/** Helper function to get text content of an element */
function getTextContent(element: ChildNode): string {
  return (element.textContent || '').trim();
}

/**
 * Helper function to get next child element of this element's parent. Almost the exact same as
 * `element.nextElementSibling` (which is not available in Node), but this returns `undefined`
 * because `null` is dumb
 */
function getNextElementSibling(element: Element): Element | undefined {
  const parent = element.parentNode;

  if (!parent) return undefined;

  let foundThisElement = false;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const sibling = parent.childNodes[i];

    if (!foundThisElement) {
      if (sibling === element) foundThisElement = true;
      continue;
    }

    // Child is not an element node, so skip
    if (sibling.nodeType !== NODE_TYPE.ELEMENT) continue;

    return sibling as Element;
  }

  return undefined;
}

/**
 * Helper function to get next child comment-like node of this element's parent. Similar to
 * `element.nextSibling`, but this specifically finds an `a:documentation` element or a `Comment`
 * node. It also returns `undefined` because `null` is dumb
 */
function getNextCommentSibling(element: Element): ChildNode | undefined {
  const parent = element.parentNode;

  if (!parent) return undefined;

  let foundThisElement = false;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const sibling = parent.childNodes[i];

    if (!foundThisElement) {
      if (sibling === element) foundThisElement = true;
      continue;
    }

    // Child is not an `a:documentation` node or a `Comment` node, so skip
    if (sibling.nodeName !== 'a:documentation' && sibling.nodeType !== NODE_TYPE.COMMENT) continue;

    return sibling;
  }

  return undefined;
}

/** Helper function to get child elements by tag name (not deep search) */
function getChildElementsByTagName(parent: Element, tagName: string): Element[] {
  const elements: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    // Child is not an element node, so skip
    if (parent.childNodes[i].nodeType !== NODE_TYPE.ELEMENT) continue;

    const child = parent.childNodes[i] as Element;
    if (
      child.nodeType === NODE_TYPE.ELEMENT &&
      child.tagName.toLowerCase() === tagName.toLowerCase()
    ) {
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
 * Helper function to get an element's name from either its attribute or its direct child name
 * element
 *
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
 * @param objectType Type of object e.g. "marker"
 * @param objectName Name of object e.g. "esb"
 * @param propertyName Name of property that had the conflict e.g. "default attribute"
 * @param defineName Name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingValue Existing property value
 * @param newValue New property value that is causing the conflict
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
 * Log a warning while merging two objects that one object had a property and the other did not and
 * that the merge will use the present property value
 *
 * @param objectType Type of object e.g. "marker"
 * @param objectName Name of object e.g. "esb"
 * @param propertyName Name of property that had the conflict e.g. "default attribute"
 * @param defineName Name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingValue Existing property value
 * @param newValue New value for the property
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
 * @param objectType Type of object e.g. "marker"
 * @param objectName Name of object e.g. "esb"
 * @param propertyName Name of property that is being merged e.g. "default attribute"
 * @param defineName Name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingString Existing string
 * @param newString New string to merge into the existing string
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
 * Merge two strings, deduplicating and concatenating the strings with `\n` between.
 *
 * @param objectType Type of object e.g. "marker"
 * @param objectName Name of object e.g. "esb"
 * @param propertyName Name of property that is being merged e.g. "default attribute"
 * @param defineName Name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingString Existing string
 * @param newString New string to merge into the existing string
 * @param shouldWarn `true` if we should warn if only one string is defined or if both strings are
 *   defined and get combined
 * @returns String consisting of both passed in strings concatenated or `undefined` if there was no
 *   string passed in
 */
function mergeStrings(
  objectType: string,
  objectName: string,
  propertyName: string,
  defineName: string,
  existingString: string | undefined,
  newString: string | undefined,
  shouldWarn = false
) {
  // If they're the same (`undefined` or a string), just return it
  if (existingString === newString) return existingString;

  // If only one string is defined, just return that
  if (!existingString || !newString) {
    if (shouldWarn) {
      logObjectUseOnePropertyWarning(
        objectType,
        objectName,
        propertyName,
        defineName,
        existingString,
        newString
      );
    }
    return existingString ?? newString;
  }

  // If the new string is one of any in the string split by \n, just return the existing one
  if (existingString.split('\n').includes(newString)) return existingString;

  // Both strings are defined but don't match, so concat them
  if (shouldWarn) {
    console.log(
      `Warning: ${objectType} named "${
        objectName
      }" has two definitions with different ${propertyName} strings: ${JSON.stringify(
        existingString
      )}, ${JSON.stringify(newString)}. Concatenating them with \\n between. In definition: ${defineName}`
    );
  }

  return `${existingString}\n${newString}`;
}

/**
 * Merge two arrays, combining and deduplicating contents. Returns a new array if the merge changed
 * anything; does not modify the original arrays
 *
 * @param objectType Type of object e.g. "marker"
 * @param objectName Name of object e.g. "esb"
 * @param propertyName Name of property that is being merged e.g. "default attribute"
 * @param defineName Name of `define` tag that is the source of this object e.g. "Sidebar"
 * @param existingArray Existing array
 * @param newArray New array to merge into the existing array
 * @returns Array with merged contents or `undefined` if there was no array
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
    return existingArray ?? newArray;
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
 * Verify that two markers with the same name are similar enough that they can merge, then merge
 * them
 *
 * @param markerA Existing marker info
 * @param markerB New marker info
 * @param markerName Name of marker being compared (for error messages)
 * @param defineName Name of definition adding the new marker (for error messages)
 * @returns Merged marker info with markerA properties combined with markerB properties
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

  // If isClosingMarkerOptional is not `undefined` and is being changed, that's an error
  // The data seems too sparse to be able to confidently say if the boolean ever changes, it's
  // an error
  if (
    markerA.isClosingMarkerOptional !== undefined &&
    markerA.isClosingMarkerOptional !== markerB.isClosingMarkerOptional
  ) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER,
      markerName,
      'isClosingMarkerOptional',
      defineName,
      markerA.isClosingMarkerOptional,
      markerB.isClosingMarkerOptional
    );
    process.exit(1);
  }

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

  // Check textContentAttribute can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerName,
    'textContentAttribute',
    defineName,
    markerA.textContentAttribute,
    markerB.textContentAttribute
  );

  // Check parseUsfmInstructions can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerName,
    'parseUsfmInstructions',
    defineName,
    markerA.parseUsfmInstructions,
    markerB.parseUsfmInstructions
  );

  // Combine leadingAttributes
  const mergedLeadingAttributes = mergeArrays(
    OBJECT_TYPE_MARKER,
    markerName,
    'leadingAttributes',
    defineName,
    markerA.leadingAttributes,
    markerB.leadingAttributes
  );
  if (mergedLeadingAttributes) mergedMarker.leadingAttributes = mergedLeadingAttributes;

  // Combine descriptions
  const mergedDescription = mergeStrings(
    OBJECT_TYPE_MARKER,
    markerName,
    'description',
    defineName,
    markerA.description,
    markerB.description
  );
  if (mergedDescription) mergedMarker.description = mergedDescription;

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

  const mergedIsAttributeMarkerForRegExp = mergeArrays(
    OBJECT_TYPE_MARKER,
    markerName,
    'isAttributeMarkerForRegExp',
    defineName,
    attributeMarkerA.isAttributeMarkerForRegExp,
    attributeMarkerB.isAttributeMarkerForRegExp
  );
  if (mergedIsAttributeMarkerForRegExp)
    attributeMergedMarker.isAttributeMarkerForRegExp = mergedIsAttributeMarkerForRegExp;

  // If hasStructuralSpaceAfterClosingMarker is not `undefined` and is being changed, that's an error
  // The data seems too sparse to be able to confidently say if the boolean ever changes, it's
  // an error
  if (
    attributeMarkerA.hasStructuralSpaceAfterCloseAttributeMarker !== undefined &&
    attributeMarkerA.hasStructuralSpaceAfterCloseAttributeMarker !==
      attributeMarkerB.hasStructuralSpaceAfterCloseAttributeMarker
  ) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerName,
      'hasStructuralSpaceAfterCloseAttributeMarker',
      defineName,
      attributeMarkerA.hasStructuralSpaceAfterCloseAttributeMarker,
      attributeMarkerB.hasStructuralSpaceAfterCloseAttributeMarker
    );
    process.exit(1);
  }

  // Check attributeMarkerAttributeName can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerName,
    'attributeMarkerAttributeName',
    defineName,
    attributeMarkerA.attributeMarkerAttributeName,
    attributeMarkerB.attributeMarkerAttributeName
  );

  // Make sure the requirements for `AttributeMarkerInfo` are met if any `AttributeMarkerInfo` properties
  // are present
  if (
    (attributeMergedMarker.isAttributeMarkerFor ||
      attributeMergedMarker.isAttributeMarkerForRegExp) &&
    !attributeMergedMarker.attributeMarkerAttributeName
  ) {
    console.log(
      `Error: While merging, ${OBJECT_TYPE_MARKER} ${markerName} has isAttributeMarkerFor ${JSON.stringify(
        attributeMergedMarker.isAttributeMarkerFor
      )} and isAttributeMarkerForRegExp ${
        attributeMergedMarker.isAttributeMarkerForRegExp
      } but has no attributeMarkerAttributeName. Must have attributeMarkerAttributeName. Merging in define ${
        defineName
      }`
    );
    process.exit(1);
  }

  return mergedMarker;
}

/**
 * Verify that two marker types with the same name are similar enough that they can merge, then
 * merge them
 *
 * @param markerTypeA Existing marker type info
 * @param markerTypeB New marker type info
 * @param markerTypeName Name of marker type being compared (for error messages)
 * @param defineName Name of definition adding the new marker type (for error messages)
 * @returns Merged marker type info with markerTypeA properties combined with markerTypeB properties
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
  if (markerTypeA.hasNewlineBefore !== markerTypeB.hasNewlineBefore) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'hasNewlineBefore',
      defineName,
      markerTypeA.hasNewlineBefore,
      markerTypeB.hasNewlineBefore
    );
    process.exit(1);
  }
  if (markerTypeA.isCloseable !== markerTypeB.isCloseable) {
    logObjectMergeConflictError(
      OBJECT_TYPE_MARKER_TYPE,
      markerTypeName,
      'isCloseable',
      defineName,
      markerTypeA.isCloseable,
      markerTypeB.isCloseable
    );
    process.exit(1);
  }

  // Check outputToUsfmInstructions can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerTypeName,
    'outputToUsfmInstructions',
    defineName,
    markerTypeA.outputToUsfmInstructions,
    markerTypeB.outputToUsfmInstructions
  );

  // Check parseUsfmInstructions can be merged
  verifyStringsCanBeMerged(
    OBJECT_TYPE_MARKER,
    markerTypeName,
    'parseUsfmInstructions',
    defineName,
    markerTypeA.parseUsfmInstructions,
    markerTypeB.parseUsfmInstructions
  );

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
 * Create a list of all USFM-style (not XML) attributes for the marker an element represents. Also
 * gather some information about those attributes.
 *
 * These attributes are children of the element and attributes found in refs in the element.
 *
 * The information returned alongside the attributes in this function is only the information about
 * attributes that is gathered differently based on if the attribute is a child of the element or if
 * the attribute is found through a ref in the element. Plus some derived data that will also be
 * used to determine information that is gathered the same way for all attributes.
 *
 * @param element The XML element that represents the marker being processed
 * @param markerType Type of the marker being processed
 * @param defineElements The collection of all define elements (for reference lookups)
 * @param defineName Name of `define` containing this `element` (for error messages)
 * @returns Array of objects containing the attribute and some info about that attribute
 */
function collectAttributesForElement(
  element: Element,
  markerType: string,
  defineElements: Array<Element>,
  defineName: string
) {
  // Make a list of attribute elements to process along with some info we need to determine
  // differently based on if the attribute is a child or in a ref
  // These attributes are children of the element and attributes found in refs in the element
  const elementAttributes: {
    /** The `attribute` element in the marker we are analyzing */
    attribute: Element;
    /** The name of the attribute we are analyzing */
    // We already got attribute name, so might as well include it
    attributeName: string;
    /** Whether this attribute is marked as optional */
    // ref may be inside optional, so we determine isOptional differently between the two kinds
    isOptional?: boolean;
    /** Whether this attribute should be skipped when outputting the marker to USFM */
    // ref may have usfm:ignore on it, so determine skipOutputToUsfm differently between the two
    skipOutputToUsfm?: boolean;
  }[] = [];

  // ENHANCE: This would best be improved by properly walking through the `attribute` and `ref` tags in
  // their encountered order so we can properly determine the order for default attribute, but right now
  // we are looking at all `attribute` tags first then `ref` tags after. Luckily, it doesn't matter right
  // now for determining default attribute. It very well may never matter as this way of determining
  // attribute order is mostly limited to less-than-3.1 (though it is used in a couple places in 3.1+).

  // Look through child attributes of the element
  const childAttributes = element.getElementsByTagName('attribute');
  for (let i = 0; i < childAttributes.length; i++) {
    const attribute = childAttributes[i];

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
        `Warning: Found ref element without a name attribute in marker type "${markerType}" in definition "${defineName}". Skipping.`
      );
      continue;
    }

    // Check to make sure this ref is a direct child or a child of an optional of the element or child
    // under group. If not, skip it
    let isRefOptional = false;
    let parent = ref.parentNode;
    if (!parent) continue;
    if (parent.nodeName === 'optional') {
      isRefOptional = true;
      parent = parent.parentNode;
      if (!parent) continue;
    }
    if (parent.nodeName === 'group') {
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

  // Finish determining the fields with some logic that is the same no matter where the
  // attribute comes from
  const finalElementAttributes: ((typeof elementAttributes)[number] & {
    /** The `usfm:match` elements that are direct children of this `attribute` element */
    usfmMatchElements: Element[];
  })[] = elementAttributes.map(elementAttribute => {
    const { attribute, attributeName } = elementAttribute;
    // We did some computation on skipOutputToUsfm for when the attribute is through a ref,
    // but we need to do more to determine if we should skip outputting this attribute to USFM
    // As such, this is just a `let` so we can modify it
    let { skipOutputToUsfm } = elementAttribute;

    // Get the `usfm:match` elements because we will do lots with them
    const usfmMatchElements = getChildElementsByTagName(attribute, 'usfm:match');

    // Skip output attribute may have `usfm:ignore="true"` directly on it
    if (!skipOutputToUsfm) skipOutputToUsfm = attribute.getAttribute('usfm:ignore') === 'true';
    // Skip output attribute may have child `name` element with `ns` attribute set to XML schema
    if (!skipOutputToUsfm) {
      const nameElement = getFirstChildWithTagName(attribute, 'name', defineName);
      if (
        nameElement &&
        nameElement.getAttribute('ns') === 'http://www.w3.org/2001/XMLSchema-instance'
      )
        skipOutputToUsfm = true;
    }
    // Skip output attribute name starts with `xsi:` (also indicates it is XML schema-related)
    if (!skipOutputToUsfm && attributeName.startsWith('xsi:')) skipOutputToUsfm = true;

    // Special case: some exceptions for skipping output to USFM - I think these are errors in `usx.rng`
    // If the errors are fixed, these should be removed
    if ((markerType === 'para' || markerType === 'table') && attributeName === 'vid')
      skipOutputToUsfm = true;
    else if (markerType === 'chapter' && attributeName === 'sid') skipOutputToUsfm = true;
    else if (markerType === 'cell' && attributeName === 'align') skipOutputToUsfm = true;

    return { ...elementAttribute, skipOutputToUsfm, usfmMatchElements };
  });

  return finalElementAttributes;
}

/**
 * Determine if the XML element indicates that the marker type has a newline before it in USFM.
 *
 * This XML element may be a `style` attribute, an `element` element representing a marker type, or
 * a "`usfm:tag`-like" element (`usfm:tag`, `usfm:ptag`, `usfm:match`)
 *
 * @param element XML element to check
 * @param elementType What kind of element this is (for logging)
 * @param markerType Which marker type this is (for logging)
 * @param defineName Name of `define` containing this XML element (for error messages)
 * @returns `true` if the element indicates the marker type has a newline before it in USFM, `false`
 *   if the element indicates the marker type does not have a newline before it in USFM, and
 *   `undefined` if the element doesn't have any indication either way.
 */
function determineHasNewlineBeforeForElement(
  element: Element,
  elementType: string,
  markerType: string,
  defineName: string
) {
  // Special case: cell has `usfm:ptag` though it doesn't have a newline after it. I think this
  // is an error in `usx.rng`
  // If the error is fixed, this should be removed
  if (markerType === 'cell') return false;
  // Special case: periph has `usfm:match` though it doesn't have a newline in it. I think this
  // is an error in `usx.rng`
  // If the error is fixed, this should be removed
  if (markerType === 'periph') return true;
  // Special case: usx has `usfm:match` though it doesn't have a newline in it. I think this
  // is an error in `usx.rng`
  // If the error is fixed, this should be removed
  if (markerType === 'usx') return true;

  const isElementUsfmTagLike =
    element.tagName === 'usfm:tag' ||
    element.tagName === 'usfm:ptag' ||
    element.tagName === 'usfm:match';
  const elementUsfmTagLikeElements = isElementUsfmTagLike
    ? [element]
    : getChildElementsByTagName(element, 'usfm:tag')
        .concat(getChildElementsByTagName(element, 'usfm:ptag'))
        .concat(getChildElementsByTagName(element, 'usfm:match'));

  if (elementUsfmTagLikeElements.length === 0) return undefined;

  if (elementUsfmTagLikeElements.length > 1) {
    console.log(
      `Error: ${elementType} for marker type "${
        markerType
      }" has more than one usfm:tag or usfm:ptag or usfm:match. This is unexpected; algorithms may need to change. In define ${
        defineName
      }`
    );
    process.exit(1);
  }

  const styleUsfmTagElement = elementUsfmTagLikeElements[0];

  // has newline before if it is a `usfm:ptag` or `beforeout` has newline in it
  return (
    styleUsfmTagElement.tagName === 'usfm:ptag' ||
    styleUsfmTagElement.getAttribute('beforeout')?.includes('\\n')
  );
}

/**
 * Get the `usfm:endtag` element associated with a marker type `element` if one exists.
 *
 * @param element Marker type `element`
 * @param markerType Which marker type this is (for logging)
 * @param defineName Name of `define` containing this XML element (for error messages)
 * @returns `usfm:endtag` element for this marker type `element` or `undefined` if one was not found
 */
function getUsfmEndTagForElement(element: Element, markerType: string, defineName: string) {
  let usfmEndTagElement: Element | undefined;
  const usfmEndTagElements = element.getElementsByTagName('usfm:endtag');
  if (usfmEndTagElements.length > 0) {
    // There were at least one `usfm:endtag` elements in the element, so verify we can use the first one
    usfmEndTagElement = usfmEndTagElements[0];

    if (usfmEndTagElements.length > 2) {
      console.log(
        `Error: Could not determine if marker type should have a closing tag. Marker type "${
          markerType
        }" has more than two usfm:endtag elements. In define ${defineName}`
      );
      process.exit(1);
    }

    if (usfmEndTagElements.length === 2) {
      // Determine if the two elements are basically just `\nd` and `\+nd`
      // by checking all attributes are the same except `matchref` and the `+` in `before`
      const secondEndTagElement = usfmEndTagElements[1];

      const firstAttributes = Array.from(usfmEndTagElement.attributes);
      const secondAttributes = Array.from(secondEndTagElement.attributes);

      if (
        firstAttributes.length !== secondAttributes.length ||
        firstAttributes.some(firstAttribute => {
          const secondAttribute = secondAttributes.find(
            secondAttributeToCheck => secondAttributeToCheck.name === firstAttribute.name
          );
          // If the second end tag doesn't have this attribute, they don't match
          if (!secondAttribute) return true;

          // matchref doesn't have to match, funny enough
          if (firstAttribute.name === 'matchref') return false;

          if (firstAttribute.name === 'before') {
            // Before should match other than a + in one
            return firstAttribute.value.replace('+', '') !== secondAttribute.value.replace('+', '');
          }

          return firstAttribute.value !== secondAttribute.value;
        })
      ) {
        console.log(
          `Error: Could not determine if marker type should have a closing tag. Marker type "${
            markerType
          }" has two usfm:endtag elements whose attributes don't match. In define ${defineName}`
        );
        process.exit(1);
      }
    }
  } else {
    const nextElementSibling = getNextElementSibling(element);
    if (nextElementSibling?.tagName === 'usfm:endtag') {
      // There are no `usfm:endtag` elements in this element, but the next sibling is one!
      usfmEndTagElement = nextElementSibling;
    }
  }

  return usfmEndTagElement;
}

/**
 * Process a define element to extract marker information
 *
 * @param defineElement The define element to process
 * @param defineElements The collection of all define elements (for reference lookups)
 * @param markersMap The markers map to populate
 * @param skippedDefinitions Set to populate with names of definitions that were skipped
 * @param skipOutputMarkerToUsfmDefineNames Array of names of `define` elements whose marker
 *   definitions describe markers that should not be exported to USFM (e.g. which attributes
 *   indicate that the marker should not be exported to USFM)
 * @param isVersion3_1OrAbove Whether the `usx.rng` file is from 3.1+. 3.1+ has much more
 *   information that we can use
 */
function processDefineElement(
  defineElement: Element,
  defineElements: Array<Element>,
  markersMap: MarkersMap,
  skippedDefinitions: Set<string>,
  skipOutputMarkerToUsfmDefineNames: Set<string>,
  isVersion3_1OrAbove: boolean
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
    // There may be independent closing markers for these markers
    const independentClosingMarkersToAdd: Record<string, MarkerInfo> = {};
    // Just modify the existing marker type if this marker just has information about skipping
    // it. These markers to skip don't have much information in them
    // Need the type assertion here because TypeScript gets ahead of itself otherwise and implies this
    // must be a `NonCloseableMarkerTypeInfo` since `isCloseable` is not present
    const markerTypeToAdd = (
      skipOutputMarkerToUsfm ? { ...markersMap.markerTypes[markerType] } : {}
    ) as MarkerTypeInfo;

    // Look for style attribute to get marker names
    let hasStyle = false;
    // Try to determine if the marker type should have newline before by looking at the style
    // attributes.
    let hasNewlineBefore: boolean | undefined = undefined;
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

      // Determine if there should be a newline before the marker based on the style attribute
      const styleHasNewlineBefore = determineHasNewlineBeforeForElement(
        attribute,
        'Style attribute',
        markerType,
        defineName
      );
      if (isVersion3_1OrAbove && styleHasNewlineBefore === undefined)
        console.log(
          `Warning: Style attribute for marker type "${
            markerType
          }" has no usfm:tag or usfm:ptag or usfm:match. This is unexpected; algorithms may need to change. In define ${
            defineName
          }`
        );
      if (styleHasNewlineBefore !== undefined) {
        if (hasNewlineBefore !== undefined && hasNewlineBefore !== styleHasNewlineBefore) {
          console.log(
            `Error: Marker type was found to have multiple style attributes with conflicting hasNewlineBefore. Earlier style hasNewlineBefore: ${
              hasNewlineBefore
            }; later style hasNewlineBefore: ${styleHasNewlineBefore}. In define ${defineName}`
          );
          process.exit(1);
        }
        hasNewlineBefore = styleHasNewlineBefore;
      }

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
          if (defaultAttribute) markerInfo.defaultAttribute = defaultAttribute;

          // Sometimes there is documentation right after
          const commentNode = getNextCommentSibling(styleValueElement);
          if (commentNode) markerInfo.description = getTextContent(commentNode);

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

    // Determine if there should be a newline before the marker based on the element
    const elementHasNewlineBefore = determineHasNewlineBeforeForElement(
      element,
      'Element',
      markerType,
      defineName
    );

    if (elementHasNewlineBefore !== undefined) {
      if (hasNewlineBefore !== undefined && hasNewlineBefore !== elementHasNewlineBefore) {
        console.log(
          `Error: Marker type "${markerType}" was found to have conflicting hasNewlineBefore. From style hasNewlineBefore: ${
            hasNewlineBefore
          }; From element hasNewlineBefore: ${elementHasNewlineBefore}. In define ${defineName}`
        );
        process.exit(1);
      }
      hasNewlineBefore = elementHasNewlineBefore;
    }

    // Set hasNewlineBefore on marker type if applicable
    if (hasNewlineBefore === undefined) {
      // Only 3.1+ has this data, and it's not really expected that skip output markers will have it
      if (isVersion3_1OrAbove && !skipOutputMarkerToUsfm) {
        console.log(
          `Warning: could not determine marker type "${
            markerType
          }" hasNewlineBefore. In define ${defineName}.`
        );
      }
    } else if (hasNewlineBefore) markerTypeToAdd.hasNewlineBefore = true;

    // Determine if the marker type should have a closing tag
    // First step is to find an appropriate `usfm:endtag`
    const usfmEndTagElement = getUsfmEndTagForElement(element, markerType, defineName);

    // There's an end tag, so mark that on the marker type. Also check the `usfm:endtag` for
    // being empty
    if (usfmEndTagElement) {
      markerTypeToAdd.isCloseable = true;
      if (markerTypeToAdd.isCloseable && usfmEndTagElement.getAttribute('matchref') === "''") {
        markerTypeToAdd.isClosingMarkerEmpty = true;
      }
    }

    // Determine if there is an independent closing marker for these markers in the element
    const elementUsfmTagElements = getChildElementsByTagName(element, 'usfm:tag').concat(
      getChildElementsByTagName(element, 'usfm:ptag')
    );
    elementUsfmTagElements.forEach(usfmTagElement => {
      const markerName = getTextContent(usfmTagElement);

      // If the usfm:tag or usfm:ptag is empty, it seems to be representing this opening marker and
      // will be covered below
      if (!markerName) return;

      // Determine if the independent closing marker should have a newline
      const additionalMarkerHasNewline = determineHasNewlineBeforeForElement(
        usfmTagElement,
        `additional marker "${markerName}"`,
        markerType,
        defineName
      );

      if (additionalMarkerHasNewline !== hasNewlineBefore) {
        console.log(
          `Error: additional plain marker "${markerName}" in marker type "${
            markerType
          }" has different hasNewlineBefore. marker type: ${hasNewlineBefore}; additional marker: ${
            hasNewlineBefore
          }. In define ${defineName}`
        );
        process.exit(1);
      }

      // Just set up a simple marker for now; we will add the connections between this closing marker
      // and the new markers from this element later when we have all of them
      const markerInfo: MarkerInfo = { type: markerType };

      independentClosingMarkersToAdd[markerName] = mergeMarkers(
        independentClosingMarkersToAdd[markerName],
        markerInfo,
        markerName,
        defineName
      );
    });

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

    const markerNamesToAdd = Object.keys(markersToAdd);
    const markerNamesToAddRegExp = Object.keys(markersRegExpToAdd);
    const independentClosingMarkerNamesToAdd = Object.keys(independentClosingMarkersToAdd);
    const totalNumberOfMarkersAdded =
      markerNamesToAdd.length +
      markerNamesToAddRegExp.length +
      independentClosingMarkerNamesToAdd.length;

    if (!hasStyle && totalNumberOfMarkersAdded > 1) {
      console.log(
        `Error: Marker type "${
          markerType
        }" has no "style" attribute but is trying to create ${totalNumberOfMarkersAdded} markers. This does not make sense because there must be a "style" attribute to distinguish between markers. In define ${
          defineName
        }`
      );
      process.exit(1);
    }

    // Get a list of marker names we are creating before adding attribute markers and such
    // If we are creating any new markers, we changed the markers map
    const didCreateMarker = totalNumberOfMarkersAdded > 0;

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

      // Process all found attributes and some other info and build up additional marker info
      // to put on each marker for this marker type
      const extraMarkerInfo: Partial<MarkerInfo> = {};

      // If there are independent closing markers, add them to the marker info for each marker
      if (independentClosingMarkerNamesToAdd.length > 0) {
        // Check that we don't have both normal closing marker and independent closing markers because
        // we have not necessarily perfectly factored this possibility into the markers map
        if (markerTypeToAdd.isCloseable) {
          console.log(
            `Warn: Marker type "${
              markerType
            }" has both a normal closing marker and independent closing markers ${JSON.stringify(
              independentClosingMarkerNamesToAdd
            )}. This markers map currently does not expect both to be present, so there could be issues; please investigate. In define ${defineName}`
          );
        }

        extraMarkerInfo.independentClosingMarkers = independentClosingMarkerNamesToAdd;
      }

      // Determine if the end tag is optional for all markers created by this element
      if (usfmEndTagElement?.getAttribute('noout') === 'true')
        extraMarkerInfo.isClosingMarkerOptional = true;

      // As we look through the attributes, collect attribute markers to add to the markers map
      const attributeMarkersToAdd: Record<string, MarkerInfo> = {};

      // Track the first non-optional non-skipped attributes so we can get default attribute
      let nonOptionalCount = 0;
      let firstRequiredNonSkippedAttribute: string | undefined;
      let firstOptionalNonSkippedAttribute: string | undefined;

      // Loop through all attributes and determine some characteristics
      for (let j = 0; j < elementAttributes.length; j++) {
        const { attribute, attributeName, isOptional, skipOutputToUsfm, usfmMatchElements } =
          elementAttributes[j];

        // Determine if we should manually skip this attribute
        // Always skip style attribute because it is not like other attributes and should not
        // be considered in this area
        if (attributeName === 'style') continue;
        // Special case: always skip closed attribute for now because it's a really weird
        // attribute that we have to do manual things with. Maybe we will handle this better
        // in the future
        if (attributeName === 'closed') continue;
        // Exception case - `colspan` is an attribute that gets incorporated into the marker
        // name. But it isn't marked in any special way in `usx.rng`.
        if (markerType === 'cell' && attributeName === 'colspan') continue;

        // Put this attribute in the list of marker skip attributes and continue to the next
        // attribute if any of the following are true:
        //   - This `define` is a marker that should not be output to USFM
        //   - Attribute has `usfm:match` with `noout="true"`
        if (
          skipOutputMarkerToUsfm ||
          usfmMatchElements.some(usfmMatch => usfmMatch.getAttribute('noout') === 'true')
        ) {
          if (!markerTypeToAdd.skipOutputMarkerToUsfmIfAttributeIsPresent)
            markerTypeToAdd.skipOutputMarkerToUsfmIfAttributeIsPresent = [];
          markerTypeToAdd.skipOutputMarkerToUsfmIfAttributeIsPresent.push(attributeName);
          didChangeMarkersMap = true;
          continue;
        }

        // If we should skip this attribute, add it to the skipped list on the marker type
        if (skipOutputToUsfm) {
          if (!markerTypeToAdd.skipOutputAttributeToUsfm)
            markerTypeToAdd.skipOutputAttributeToUsfm = [];
          markerTypeToAdd.skipOutputAttributeToUsfm.push(attributeName);
        }

        // Determine if this attribute is hard-coded into the USFM attributes list and specifically not
        // default attribute
        let isInAttributesListNotDefault = usfmMatchElements.some(usfmMatchElement =>
          usfmMatchElement.getAttribute('beforeout')?.includes(`|${attributeName}=`)
        );

        // Special case: in less than 3.1, the `link-__` attributes are first, but they should not be default
        // in most cases. There's not enough info for those special cases. Just say they can't be default.
        if (
          !isVersion3_1OrAbove &&
          (attributeName === 'link-href' ||
            attributeName === 'link-title' ||
            attributeName === 'link-id')
        )
          isInAttributesListNotDefault = true;

        // Determine if this meets the generic conditions to be a special type of attribute
        // - Attributes skipped when output to USFM are never special attributes becuase all special
        // attributes relate to how the attribute is output to USFM.
        // - Attributes hard-coded to be listed in the attributes list are not special attributes either.
        // - Special attributes also shouldn't have multiple `usfm:match`, `usfm:tag`, or `usfm:ptag` elements
        let canBeSpecialAttributeType = !skipOutputToUsfm && !isInAttributesListNotDefault;

        if (usfmMatchElements.length > 1) {
          console.log(
            `Warning: Attribute "${attributeName}" on marker type "${
              markerType
            }" has multiple usfm:match tags. It will not be considered for special attribute properties like leading attribute. In define ${
              defineName
            }`
          );
          canBeSpecialAttributeType = false;
        }

        const usfmTagElements = getChildElementsByTagName(attribute, 'usfm:tag');
        if (usfmTagElements.length > 1) {
          console.log(
            `Warning: Attribute "${attributeName}" on marker type "${
              markerType
            }" has multiple usfm:tag tags. It will not be considered for special attribute properties like leading attribute. In define ${
              defineName
            }`
          );
          canBeSpecialAttributeType = false;
        }

        const usfmParagraphTagElements = getChildElementsByTagName(attribute, 'usfm:ptag');
        if (usfmParagraphTagElements.length > 1) {
          console.log(
            `Warning: Attribute "${attributeName}" on marker type "${
              markerType
            }" has multiple usfm:ptag tags. It will not be considered for special attribute properties like leading attribute. In define ${
              defineName
            }`
          );
          canBeSpecialAttributeType = false;
        }

        // Determine if the attribute is a special attribute
        let isSpecialAttribute = false;

        if (canBeSpecialAttributeType) {
          const usfmMatchElement = usfmMatchElements.length > 0 ? usfmMatchElements[0] : undefined;
          const usfmTagElement = usfmTagElements.length > 0 ? usfmTagElements[0] : undefined;
          const usfmParagraphTagElement =
            usfmParagraphTagElements.length > 0 ? usfmParagraphTagElements[0] : undefined;

          // Determine if this is an attribute marker
          const matchLikeElements = [usfmMatchElement, usfmTagElement, usfmParagraphTagElement];
          // Test the found match-like elements for if they have a marker in their `beforeout` meaning
          // they would print a marker before their contents when outputting to USFM
          let isAttributeMarker = false;
          matchLikeElements.forEach(matchLikeElement => {
            if (!matchLikeElement) return;

            // Special case: `usx` `version` is not an attribute marker even though it looks just like one
            if (markerType === 'usx' && attributeName === 'version') return;

            const beforeOutMatches = BEFORE_OUT_MARKER_NAME_REGEXP.exec(
              matchLikeElement.getAttribute('beforeout') ?? ''
            );
            // Get the marker name out of the `usfm:match`-like element's `beforeout` if it exists
            const attributeMarkerName = beforeOutMatches?.[2];

            if (!attributeMarkerName) return;

            if (isAttributeMarker) {
              console.log(
                `Warning: found more than one usfm:match-like elements with beforeout with a marker inside in attribute ${
                  attributeName
                } in define ${defineName}. Ignoring all but the first.`
              );
              return;
            }
            isAttributeMarker = true;

            // If it's a `usfm:ptag`, it is a paragraph marker
            let isParagraphMarkerType = matchLikeElement.tagName === 'usfm:ptag';
            if (!isParagraphMarkerType)
              // If the `beforeout` has `\n`, it is a paragraph marker
              isParagraphMarkerType = !!beforeOutMatches[1];

            // If the closing tag has a space after it, this is a structural space
            const afterOutMatches = BEFORE_OUT_MARKER_NAME_REGEXP.exec(
              matchLikeElement.getAttribute('afterout') ?? ''
            );
            const hasStructuralSpaceAfterClosingMarker = !!afterOutMatches?.[3];

            // Create the attribute marker info and set it up to be added to the markers map
            const attributeMarkerInfo: MarkerInfo = {
              type: isParagraphMarkerType ? 'para' : 'char',
              attributeMarkerAttributeName: attributeName,
            };

            if (markerNamesToAdd.length > 0)
              attributeMarkerInfo.isAttributeMarkerFor = markerNamesToAdd;
            if (markerNamesToAddRegExp.length > 0)
              attributeMarkerInfo.isAttributeMarkerForRegExp = markerNamesToAddRegExp;
            if (hasStructuralSpaceAfterClosingMarker)
              attributeMarkerInfo.hasStructuralSpaceAfterCloseAttributeMarker =
                hasStructuralSpaceAfterClosingMarker;

            attributeMarkersToAdd[attributeMarkerName] = mergeMarkers(
              attributeMarkersToAdd[attributeMarkerName],
              attributeMarkerInfo,
              attributeMarkerName,
              defineName
            );

            // Add info about this attribute marker to the markers to add
            if (!extraMarkerInfo.attributeMarkers) extraMarkerInfo.attributeMarkers = [];
            extraMarkerInfo.attributeMarkers.push(attributeMarkerName);
          });
          isSpecialAttribute = isAttributeMarker;

          // Determine if this is a text content attribute
          if (
            !isSpecialAttribute &&
            (usfmMatchElement?.getAttribute('match') === 'TEXTNOTATTRIB' ||
              usfmMatchElement?.getAttribute('match') === 'TEXTNWS' ||
              (markerType === 'usx' && attributeName === 'version'))
          ) {
            // If the attribute is specified as matching the text content of the marker, it is a text
            // content attribute! Add info about this text content attribute to the markers
            extraMarkerInfo.textContentAttribute = attributeName;
            isSpecialAttribute = true;
          }

          // Determine if this is a leading attribute
          if (
            !isSpecialAttribute &&
            usfmMatchElement &&
            usfmMatchElement.getAttribute('match') !== 'TEXTNOTATTRIBOPT'
          ) {
            // The attribute has a `usfm:match` element and is not one of the other special attributes
            // and isn't an optional text content attribute (not supported in this script as it is only
            // relevant in deprecated Figure USFM 2.0 syntax as of 3.1), so it is a leading attribute!
            if (!extraMarkerInfo.leadingAttributes) extraMarkerInfo.leadingAttributes = [];
            extraMarkerInfo.leadingAttributes.push(attributeName);
            isSpecialAttribute = true;
          }
        }

        // Determine first required/optional attribute to figure out default attribute
        // Don't factor in attributes that:
        // - should be skipped when outputting to usfm
        // - are specifically not default attributes
        // - are special attributes which are never default attributes
        if (!skipOutputToUsfm && !isInAttributesListNotDefault && !isSpecialAttribute) {
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
      const updateMarkerInfoDefineName = `${defineName} (merging extraMarkerInfo into marker to add)`;
      for (const [markerName, markerInfo] of Object.entries(markersToAdd)) {
        // Add extra marker info to each marker we found in the element
        const updatedMarkerInfo =
          Object.keys(extraMarkerInfo).length > 0
            ? mergeMarkers(
                markerInfo,
                { ...markerInfo, ...extraMarkerInfo },
                markerName,
                updateMarkerInfoDefineName
              )
            : markerInfo;

        markersMap.markers[markerName] = mergeMarkers(
          markersMap.markers[markerName],
          updatedMarkerInfo,
          markerName,
          defineName
        );
      }

      // Add all collected RegExp markers to the main markers map, applying the extra marker info
      for (const [markerName, markerInfo] of Object.entries(markersRegExpToAdd)) {
        // Add extra marker info to each marker we found in the element
        const updatedMarkerInfo =
          Object.keys(extraMarkerInfo).length > 0
            ? mergeMarkers(
                markerInfo,
                { ...markerInfo, ...extraMarkerInfo },
                markerName,
                updateMarkerInfoDefineName
              )
            : markerInfo;

        markersMap.markersRegExp[markerName] = mergeMarkers(
          markersMap.markersRegExp[markerName],
          updatedMarkerInfo,
          markerName,
          defineName
        );
      }

      // Add all collected independent closing markers to the main markers map without the extra info
      // because it doesn't apply to them
      for (const [markerName, markerInfo] of Object.entries(independentClosingMarkersToAdd)) {
        const independentClosingMarkerExtraInfo: Partial<MarkerInfo> = {};

        if (markerNamesToAdd.length > 0)
          independentClosingMarkerExtraInfo.isIndependentClosingMarkerFor = markerNamesToAdd;
        if (markerNamesToAddRegExp.length > 0)
          independentClosingMarkerExtraInfo.isIndependentClosingMarkerForRegExp =
            markerNamesToAddRegExp;

        const updatedMarkerInfo =
          Object.keys(independentClosingMarkerExtraInfo).length > 0
            ? mergeMarkers(
                markerInfo,
                { ...markerInfo, ...independentClosingMarkerExtraInfo },
                markerName,
                `${defineName} (merging independentClosingMarkerExtraInfo into marker to add)`
              )
            : markerInfo;

        markersMap.markers[markerName] = mergeMarkers(
          markersMap.markers[markerName],
          updatedMarkerInfo,
          markerName,
          defineName
        );
      }

      // Add attribute markers without the extra info because it doesn't apply to them
      for (const [markerName, markerInfo] of Object.entries(attributeMarkersToAdd)) {
        markersMap.markers[markerName] = mergeMarkers(
          markersMap.markers[markerName],
          markerInfo,
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
          `Error: Tried adding skipOutputMarkerToUsfmIfAttributeIsPresent to marker type "${
            markerType
          }" that doesn't already exist! In ${defineName}`
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
 * Determine if the version provided is 3.1 or higher. This is important for many reasons:
 *
 * - 3.1 and up is generated pretty much completely separately from less than 3.1, so they have many
 *   differences in common with other versions in the same group
 * - Both groups have separate problems, things missing, etc. that need to be adjusted
 * - Both groups have some slight differences in how to handle them
 * - 3.1 and up has a lot more necessary information than less than 3.1, so less than 3.1 needs to
 *   build on a base generated from 3.1 or higher
 *
 * @param version Which `usx.rng` version this markers map is generated from
 * @returns `true` if 3.1 or higher; `false` otherwise
 */
export function isVersion3_1OrHigher(version: string): boolean {
  return version >= '3.1' && version !== 'master';
}

/**
 * Transform a USX RelaxNG schema into a markers map
 *
 * @param usxSchema USX RelaxNG schema
 * @param version Which USX version this schema represents
 * @param repo Repo where the USX schema file is from
 * @param commit Hash of the commit at which the USX schema file was retrieved in the specified repo
 * @param usfmToolsCommit Git tag or hash of the commit at which the markers map is being generated
 *   in this usfm-tools repo
 * @param skippedDefinitions Optional set to populate with names of definitions that did not result
 *   in adding any markers to the map. This Set is transformed in place and is not returned
 * @param baseMarkersMap Optional map to use to fill in missing marker information on the maps that
 *   are version less than 3.1. The `usx.rng` files below 3.1 do not have some necessary
 *   information.
 * @returns The generated markers map
 */
export function transformUsxSchemaToMarkersMap(
  usxSchema: string,
  version: string,
  repo: string,
  commit: string,
  usfmToolsCommit: string,
  skippedDefinitions: Set<string> = new Set<string>(),
  baseMarkersMap?: MarkersMap
): MarkersMap {
  const parser = new DOMParser();
  const doc = parser.parseFromString(usxSchema, 'text/xml');

  const markersMap: MarkersMap = {
    version,
    schemaRepo: repo,
    schemaCommit: commit,
    markersMapVersion: MARKERS_MAP_VERSION,
    usfmToolsCommit: usfmToolsCommit,
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
        `Error: Found a ref tag with both usfm:alt ${
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

  const isVersion3_1OrAbove = isVersion3_1OrHigher(version);
  // Special case: set some specific exceptions for 3.0.x because it doesn't have some info present in 3.1
  if (!isVersion3_1OrAbove) {
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
      referredIgnoreDefines,
      isVersion3_1OrAbove
    );
  }

  // Special case: Fill in some stuff that isn't quite right in the schema:
  // - Add the required markers that might not be in the schema
  // - Add some one-off instructions for outputting to USFM in a particularly challenging way
  // - Add some extra information to some existing markers
  const manualDefineName = 'added manually';
  // Create `usfm` marker based on `usx` marker but with some differences
  markersMap.markers['usfm'] = mergeMarkers(
    markersMap.markers['usfm'],
    {
      ...markersMap.markers['usx'],
      type: 'para',
      parseUsfmInstructions:
        "If this marker is directly after the first id marker, this marker's version attribute should determine the version attribute of the usx or USJ marker at the top of the USX or USJ document, then this marker should be removed.",
    },
    'usfm',
    manualDefineName
  );
  const usxAndUsjOutputInstructions =
    "If this marker is the top-level marker containing all other markers in this document, it should not be directly output to USFM. Instead, if this marker's version attribute is other than 3.0, a new usfm marker with this version attribute needs to be added after the id marker if one is present in the USFM.";
  // Add output instructions to `usx` marker type
  markersMap.markerTypes['usx'] = mergeMarkerTypes(
    markersMap.markerTypes['usx'],
    {
      // Add the existing properties of usx marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['usx'],
      outputToUsfmInstructions: usxAndUsjOutputInstructions,
    },
    'usx',
    manualDefineName
  );
  // Add usfm output marker name to usx marker
  markersMap.markers['usx'] = mergeMarkers(
    markersMap.markers['usx'],
    {
      // Need type so it passes TypeScript type checking
      type: 'usx',
      markerUsfm: 'usfm',
    },
    'usx',
    manualDefineName
  );
  // Create USJ marker based on usx marker
  markersMap.markers['USJ'] = mergeMarkers(
    markersMap.markers['USJ'],
    { ...markersMap.markers['usx'], type: 'USJ' },
    'USJ',
    manualDefineName
  );
  // Create USJ marker type based on usx marker type
  markersMap.markerTypes['USJ'] = mergeMarkerTypes(
    markersMap.markerTypes['USJ'],
    { ...markersMap.markerTypes['usx'], outputToUsfmInstructions: usxAndUsjOutputInstructions },
    'USJ',
    manualDefineName
  );
  // Create unmatched marker type to handle Paratext output with unmatched closing markers
  // Putting this in both spec and Paratext markers maps because spec seems to be silent regarding what
  // to do about unknown markers, and this is enough of a known case that it seems reasonable to preserve
  // it anyway. The markers map is not for validating USJ/USFM but rather for translating it, so this
  // seems reasonable enough to do.
  markersMap.markerTypes['unmatched'] = mergeMarkerTypes(
    markersMap.markerTypes['unmatched'],
    {
      description:
        'Paratext uses this type for closing markers that it cannot find opening markers for. They are treated like char markers but have no contents, no closing markers, and no space after the marker.',
      outputToUsfmInstructions:
        'Do not output a structural space after the opening marker for markers with unmatched type.',
      parseUsfmInstructions:
        'If a closing marker occurs but does not seem to have a matching opening marker, create an unmatched-type marker. There is no structural space after the unmatched-type marker; its end is determined by the asterisk at the end of the marker.',
    },
    'unmatched',
    manualDefineName
  );
  // Add parse/output instructions to cell
  markersMap.markerTypes['cell'] = mergeMarkerTypes(
    markersMap.markerTypes['cell'],
    {
      outputToUsfmInstructions:
        "If this marker has a colspan attribute, the USFM marker name should be this marker's name plus hyphen (-) plus the marker's final column number (first column number found in the marker name plus colspan minus 1). Then the colspan attribute should not be output as a USFM attribute.",
      parseUsfmInstructions:
        "If this marker's name has a hyphen (-) and a number after the marker, the USX/USJ marker name should be just the portion of the marker name before the hyphen, and it should have the colspan attribute which is the number of columns spanned by the marker (second column number plus 1 minus first column number).",
    },
    'cell',
    manualDefineName
  );
  // Set up the USJ marker type names for table content marker types row and cell
  const rowTypeNoAlternateTypes = { ...markersMap.markerTypes['row'] };
  const rowUsjType = 'table:row';
  markersMap.markerTypes['row'] = mergeMarkerTypes(
    markersMap.markerTypes['row'],
    {
      // Add the existing properties of row marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['row'],
      markerTypeUsj: rowUsjType,
    },
    'row',
    manualDefineName
  );
  markersMap.markerTypes[rowUsjType] = mergeMarkerTypes(
    rowTypeNoAlternateTypes,
    {
      // Add the existing properties of row marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['row'],
      markerTypeUsfm: 'row',
      markerTypeUsx: 'row',
    },
    rowUsjType,
    manualDefineName
  );
  const cellTypeNoAlternateTypes = { ...markersMap.markerTypes['cell'] };
  const cellUsjType = 'table:cell';
  markersMap.markerTypes['cell'] = mergeMarkerTypes(
    markersMap.markerTypes['cell'],
    {
      // Add the existing properties of cell marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['cell'],
      markerTypeUsj: cellUsjType,
    },
    'cell',
    manualDefineName
  );
  markersMap.markerTypes[cellUsjType] = mergeMarkerTypes(
    cellTypeNoAlternateTypes,
    {
      // Add the existing properties of cell marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['cell'],
      markerTypeUsfm: 'cell',
      markerTypeUsx: 'cell',
    },
    cellUsjType,
    manualDefineName
  );
  // Add the nested prefix + to char marker. This is technically in `usx.rng` 3.1+, but it's quite
  // strange and probably not worth deriving as we are phasing nested prefixes out anyway.
  markersMap.markerTypes['char'] = mergeMarkerTypes(
    markersMap.markerTypes['char'],
    {
      // Add the existing properties of char marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['char'],
      nestedPrefix: '+',
    },
    'char',
    manualDefineName
  );
  // Add instructions for converting figure attribute between USFM src and USX/USJ file
  markersMap.markerTypes['figure'] = mergeMarkerTypes(
    markersMap.markerTypes['figure'],
    {
      // Add the existing properties of figure marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['figure'],
      outputToUsfmInstructions: 'The USX/USJ file attribute needs its name changed to src in USFM',
      parseUsfmInstructions: 'The USFM src attribute needs its name changed to file in USX/USJ',
    },
    'figure',
    manualDefineName
  );
  // Indicate table-type markers should be removed outputting to USFM. Probably would be best for
  // `usx.rng` to have something indicating this because this may not be the case in v3.2 or v4.
  // See https://github.com/usfm-bible/tcdocs/blob/main/proposals/2025/U25003%20Lists%20and%20Tables.md
  markersMap.markerTypes['table'] = mergeMarkerTypes(
    markersMap.markerTypes['table'],
    {
      // Add the existing properties of table marker type so we don't have conflicts merging types
      ...markersMap.markerTypes['table'],
      skipOutputMarkerToUsfm: true,
    },
    'table',
    manualDefineName
  );

  // Special case: Fix some inaccuracies in less than 3.1
  if (!isVersion3_1OrAbove) {
    // periph does not have a default attribute. `id` looks like it is default, but it always uses
    // non-default syntax for some reason
    if (markersMap.markers['periph']?.defaultAttribute === 'id')
      delete markersMap.markers['periph'].defaultAttribute;

    // `ts` seems to be misidentified as `para`, but it is a milestone
    if (markersMap.markers['ts']?.type === 'para') markersMap.markers['ts'].type = 'ms';

    // Add `fig` which seems to be mistakenly missing style in less than 3.1 and therefore doesn't get
    // included. (`figure` type is being added in section above)
    markersMap.markers['fig'] = mergeMarkers(
      markersMap.markers['fig'],
      { type: 'figure' },
      'fig',
      manualDefineName
    );

    // Less than 3.1 doesn't have `esbe`, the end marker for `esb`, because it only has USX information
    markersMap.markers['esb'] = mergeMarkers(
      markersMap.markers['esb'],
      { type: 'sidebar', independentClosingMarkers: ['esbe'] },
      'esb',
      manualDefineName
    );
    markersMap.markers['esbe'] = mergeMarkers(
      markersMap.markers['esbe'],
      { type: 'sidebar', isIndependentClosingMarkerFor: ['esb'] },
      'esbe',
      manualDefineName
    );

    // Less than 3.1 seems to be missing `sts` marker
    markersMap.markers['sts'] = mergeMarkers(
      markersMap.markers['sts'],
      { type: 'para' },
      'sts',
      manualDefineName
    );

    // Less than 3.1 seems to be missing `efe` marker
    markersMap.markers['efe'] = mergeMarkers(
      markersMap.markers['efe'],
      { type: 'note' },
      'efe',
      manualDefineName
    );

    // Indicate ref-type markers should be removed outputting to USFM in less than 3.1 because ref was
    // introduced into the standard in 3.1, but Paratext generates ref when transforming from USFM to
    // USX even in 3.0.
    markersMap.markerTypes['ref'] = mergeMarkerTypes(
      markersMap.markerTypes['ref'],
      {
        // Add the existing properties of ref marker type so we don't have conflicts merging types
        ...markersMap.markerTypes['ref'],
        skipOutputMarkerToUsfm: true,
      },
      'ref',
      manualDefineName
    );

    // Less than 3.1 has link-href as first attribute in too many places. Just hard-code for these two
    markersMap.markers['jmp'] = mergeMarkers(
      markersMap.markers['jmp'],
      {
        type: 'char',
        defaultAttribute: 'link-href',
      },
      'jmp',
      manualDefineName
    );
    markersMap.markers['xt'] = mergeMarkers(
      markersMap.markers['xt'],
      {
        type: 'char',
        defaultAttribute: 'link-href',
      },
      'xt',
      manualDefineName
    );

    // Less than 3.1 has a bunch of problems with milestone default attributes
    markersMap.markers['qt-s'] = mergeMarkers(
      markersMap.markers['qt-s'],
      { type: 'ms', defaultAttribute: 'who' },
      'qt-s',
      manualDefineName
    );
    markersMap.markers['qt1-s'] = mergeMarkers(
      markersMap.markers['qt1-s'],
      { type: 'ms', defaultAttribute: 'who' },
      'qt1-s',
      manualDefineName
    );
    markersMap.markers['qt2-s'] = mergeMarkers(
      markersMap.markers['qt2-s'],
      { type: 'ms', defaultAttribute: 'who' },
      'qt2-s',
      manualDefineName
    );
    markersMap.markers['qt3-s'] = mergeMarkers(
      markersMap.markers['qt3-s'],
      { type: 'ms', defaultAttribute: 'who' },
      'qt3-s',
      manualDefineName
    );
    markersMap.markers['qt4-s'] = mergeMarkers(
      markersMap.markers['qt4-s'],
      { type: 'ms', defaultAttribute: 'who' },
      'qt4-s',
      manualDefineName
    );
    markersMap.markers['qt5-s'] = mergeMarkers(
      markersMap.markers['qt5-s'],
      { type: 'ms', defaultAttribute: 'who' },
      'qt5-s',
      manualDefineName
    );
    markersMap.markers['qt-e'] = mergeMarkers(
      markersMap.markers['qt-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'qt-e',
      manualDefineName
    );
    markersMap.markers['qt1-e'] = mergeMarkers(
      markersMap.markers['qt1-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'qt1-e',
      manualDefineName
    );
    markersMap.markers['qt2-e'] = mergeMarkers(
      markersMap.markers['qt2-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'qt2-e',
      manualDefineName
    );
    markersMap.markers['qt3-e'] = mergeMarkers(
      markersMap.markers['qt3-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'qt3-e',
      manualDefineName
    );
    markersMap.markers['qt4-e'] = mergeMarkers(
      markersMap.markers['qt4-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'qt4-e',
      manualDefineName
    );
    markersMap.markers['qt5-e'] = mergeMarkers(
      markersMap.markers['qt5-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'qt5-e',
      manualDefineName
    );
    markersMap.markers['t-s'] = mergeMarkers(
      markersMap.markers['t-s'],
      { type: 'ms', defaultAttribute: 'sid' },
      't-s',
      manualDefineName
    );
    markersMap.markers['t-e'] = mergeMarkers(
      markersMap.markers['t-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      't-e',
      manualDefineName
    );
    markersMap.markers['ts-s'] = mergeMarkers(
      markersMap.markers['ts-s'],
      { type: 'ms', defaultAttribute: 'sid' },
      'ts-s',
      manualDefineName
    );
    markersMap.markers['ts-e'] = mergeMarkers(
      markersMap.markers['ts-e'],
      { type: 'ms', defaultAttribute: 'eid' },
      'ts-e',
      manualDefineName
    );
  }

  // Fill in missing information from the base markers map
  if (baseMarkersMap) {
    Object.entries(markersMap.markers).forEach(([markerName, markerInfo]) => {
      let baseMarkerInfo = baseMarkersMap.markers[markerName];
      if (!markerInfo || !baseMarkerInfo) return [markerName, markerInfo];

      // If default attribute is already somewhere in base marker's attributes, remove it
      // because it was mis-labeled because there wasn't enough info to know what it was
      if (markerInfo.defaultAttribute) {
        // Collect all attribute names
        const baseMarkerAttributeNames = [
          ...(baseMarkerInfo.leadingAttributes ?? []),
          baseMarkerInfo.textContentAttribute,
        ];
        if (baseMarkerInfo.textContentAttribute)
          baseMarkerAttributeNames.push(baseMarkerInfo.textContentAttribute);
        if (baseMarkerInfo.attributeMarkers) {
          baseMarkerInfo.attributeMarkers.forEach(attributeMarkerName => {
            const attributeMarker = baseMarkersMap.markers[attributeMarkerName];
            if (!attributeMarker || !('attributeMarkerAttributeName' in attributeMarker)) return;
            baseMarkerAttributeNames.push(attributeMarker.attributeMarkerAttributeName);
          });
        }

        // If the default attribute is found in the base attributes, get rid of it
        if (baseMarkerAttributeNames.includes(markerInfo.defaultAttribute))
          delete markerInfo.defaultAttribute;
      }

      // Special case: `k`'s default attribute was introduced in 3.1
      if (!isVersion3_1OrAbove && markerName === 'k') {
        baseMarkerInfo = { ...baseMarkerInfo };
        delete baseMarkerInfo.defaultAttribute;
      }

      // Fill in all information from base
      markersMap.markers[markerName] = { ...baseMarkerInfo, ...markerInfo };
    });

    Object.entries(markersMap.markerTypes).forEach(([markerType, markerTypeInfo]) => {
      const baseMarkerTypeInfo = baseMarkersMap.markerTypes[markerType];
      if (!markerTypeInfo || !baseMarkerTypeInfo) return [markerType, markerTypeInfo];
      // Fill in all information from base
      markersMap.markerTypes[markerType] = { ...baseMarkerTypeInfo, ...markerTypeInfo };
    });
  }

  // Sort the markers, marker types, and `isAttributeMarkerFor`s
  markersMap.markers = Object.fromEntries(
    Object.entries(markersMap.markers).sort(([markerNameA], [markerNameB]) => {
      return compareStringsInvariantCaseInsensitive(markerNameA, markerNameB);
    })
  );
  markersMap.markersRegExp = Object.fromEntries(
    Object.entries(markersMap.markersRegExp).sort(([markerNameA], [markerNameB]) => {
      return compareStringsInvariantCaseInsensitive(markerNameA, markerNameB);
    })
  );
  markersMap.markerTypes = Object.fromEntries(
    Object.entries(markersMap.markerTypes).sort(([markerTypeA], [markerTypeB]) => {
      return compareStringsInvariantCaseInsensitive(markerTypeA, markerTypeB);
    })
  );
  Object.values(markersMap.markers)
    .concat(Object.values(markersMap.markersRegExp))
    .forEach(markerInfo => {
      if (!markerInfo || !('attributeMarkerAttributeName' in markerInfo)) return;

      markerInfo.isAttributeMarkerFor?.sort(compareStringsInvariantCaseInsensitive);
      markerInfo.isAttributeMarkerForRegExp?.sort(compareStringsInvariantCaseInsensitive);
    });

  return markersMap;
}
