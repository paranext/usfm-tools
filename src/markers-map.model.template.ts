/**
 * Information about a USFM/USX/USJ marker that is essential for proper translation between
 * formats
 */
export interface MarkerInfo {
  /**
   * Which marker type the marker is. Determines how the marker is structured in the data such as what kind
   * of mandatory whitespace is around the marker in USFM
   */
  type: string;
  /**
   * Which attribute can be provided without specifying the attribute name in USFM.
   *
   * A marker can have a default attribute only if it has zero or one non-optional attributes.
   *
   * An attribute can be provided with default syntax in the USFM only if it is the only attribute provided
   * for the marker.
   *
   * Following is an example of a marker with a default attribute:
   *
   * ```
   * \w stuff|thisIsTheLemmaDefaultAttribute\w*
   * ```
   *
   * Following is an example of a marker with multiple attributes (cannot use default attribute syntax):
   *
   * ```
   * \w stuff|lemma="thisIsTheLemma" strong="H1234,G1234"\w*
   * ```
   */
  defaultAttribute?: string;
}

/** Information about a USFM/USX/USJ marker type that is essential for proper translation between formats */
export interface MarkerTypeInfo {
  // Currently empty, but may be filled with information about the marker types in the future
}

/** A map of all USFM/USX/USJ markers and some information about them */
export interface MarkersMap {
  /** Which version of USFM/USX/USJ this map represents */
  version: string;
  /**
   * Which commit this map came from. This is necessary because the schema file seems to be distributed
   * multiple times in one release version. As such, this specifies the exact version of the schema file.
   */
  commit: string;
  /**
   * Map whose keys are the marker names and whose values are information about that marker
   *
   * If you find the marker name in this map, you do not need to search the `markersRegExp` map.
   */
  markers: Record<string, MarkerInfo>;
  /**
   * Map whose keys are string representations of `RegExp` patterns to match against marker names (using
   * the [test](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test) function)
   * and whose values are information about that marker
   *
   * You do not need to search this map if you found the marker name in the `markers` map.
   */
  markersRegExp: Record<string, MarkerInfo>;
  /** Map whose keys are the marker types and whose values are information about that marker type */
  markerTypes: Record<string, MarkerTypeInfo>;
}

/** A map of all USFM/USX/USJ markers and some information about them. Generated from a `usx.rng` file */
export const USFM_MARKERS_MAP = '%USFM_MARKERS_MAP_REPLACE_ME%';
