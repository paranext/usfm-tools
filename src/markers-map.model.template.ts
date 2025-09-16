/**
 * Information about a USFM marker that is just an attribute in USX/USJ. See {@link MarkerInfo} for other
 * kinds of markers.
 *
 * An attribute marker is a marker that adds information to a previous marker in USFM and is an attribute
 * on that previous marker instead in USX/USJ.
 *
 * For example, `ca` and `cp` are attribute markers for `c`. `va` and `vp` are attribute markers for `v`.
 * `cat` is an attribute marker for `f`, `esb`, and more.
 *
 * Following is an example of using the `ca` and `cp` attribute markers in USFM:
 *
 * ```usfm
 * \c 1 \ca 2\ca*
 * \cp A
 * \s1 This is a section header
 * ```
 *
 * The equivalent in USX would be:
 *
 * ```xml
 * <chapter number="1" style="c" altnumber="2" pubnumber="A" sid="GEN 1" />
 * <para style="s1">This is a section header</para>
 * ```
 */
export type AttributeMarkerInfo = NormalMarkerInfo & {
  /**
   * List of markers for which this marker is an attribute marker.
   *
   * For example, `ca` and `cp` are attribute markers for `c`. `isAttributeMarkerFor` would be `['c']` for
   * both `ca` and `cp`.
   */
  isAttributeMarkerFor: string[];
  /**
   * The name of the USX/USJ attribute this attribute marker represents.
   *
   * For example, `ca` is an attribute marker for `c` and represents the `altnumber` attribute on the `c`
   * marker in USX/USJ. `attributeMarkerAttributeName` would be `altnumber` for the `ca` marker.
   * 
   * If not provided, defaults to the marker name.
   */
  attributeMarkerAttributeName?: string;
};

/**
 * Information about a regular USFM/USX/USJ marker. See {@link MarkerInfo} for other kinds of markers.
 */
export type NormalMarkerInfo = {
  /**
   * Which marker type the marker is. Determines how the marker is structured in the data such as what kind
   * of mandatory whitespace is around the marker in USFM. See {@link MarkerTypeInfoBase} for information.
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
   * ```usfm
   * \w stuff|thisIsTheLemmaDefaultAttribute\w*
   * ```
   *
   * Following is an example of a marker with multiple attributes (cannot use default attribute syntax):
   *
   * ```usfm
   * \w stuff|lemma="thisIsTheLemma" strong="H1234,G1234"\w*
   * ```
   */
  defaultAttribute?: string;
  /**
   * List of attribute markers that may be present on this marker. This list is ordered by the order in
   * which the markers should appear.
   *
   * An attribute marker is a marker that adds information to a previous marker in USFM and is an attribute
   * on that previous marker in USX/USJ.
   *
   * For example, `ca` and `cp` are attribute markers for `c`. This value would be `['ca', 'cp']` for `c`.
   *
   * Note: the attribute names for attribute markers may be different than the marker names. See
   * {@link AttributeMarkerInfo.attributeMarkerAttributeName} for more information.
   */
  attributeMarkers?: string[];
};

/**
 * Information about a USFM/USX/USJ marker that is essential for proper translation between
 * formats
 */
export type MarkerInfo = NormalMarkerInfo | AttributeMarkerInfo;

/**
 * Information about a USFM/USX/USJ marker type that does not have a closing marker. See {@link MarkerInfo}
 * for other kinds of marker types.
 *
 * For example, `char` marker types such as `nd` markers have closing markers, but `para` markers such
 * as `p` do not:
 *
 * ```usfm
 * \p This is a plain paragraph.
 * \p This is a paragraph \nd with some special text\nd* in it.
 * ```
 *
 * If the marker type has a closing marker but the closing marker is not present in the USFM for a marker
 * with this marker type, the USX/USJ for the marker will have the attribute `closed` set to `false` unless
 * {@link CloseableMarkerTypeInfo.isClosingMarkerOptional} is `true`.
 */
export type CloseableMarkerTypeInfo = MarkerTypeInfoBase & {
  /**
   * Whether markers of this type have a closing marker in USFM.
   *
   * If not present, defaults to `false`
   */
  hasClosingMarker: true;
  /**
   * Whether the closing marker for markers of this type is explicitly considered optional in USFM.
   * 
   * If this is `false` and a closing marker for a marker of this type in USFM is *not* present, the USX/USJ
   * for that marker of this type should have the attribute `closed` set to `false`.
   * 
   * If this is `true` and a closing marker for a marker of this type in USFM *is* present, the USX/USJ
   * for that marker of this type should have the `closed` attribute set to `true`.
   * 
   * Disclaimer: Currently, this is only determined for 3.1+. It is not very important for 3.0.x- as most
   * or maybe all markers are optional in 3.0.x-.
   * 
   * Disclaimer: The implications of this value regarding when the `closed` attribute should be present are
   * interpreted from the contents of `usx.rng`. It is possible this has never been implemented, and this may
   * need to be adjusted if the eventual implementation differs from these statements.
   *
   * If not present, defaults to `false`
   */
  isClosingMarkerOptional?: boolean;
  /**
   * Whether the closing marker for markers of this type is "empty" in USFM, meaning the marker name is
   * absent from the closing marker.
   *
   * For example, markers of type `ms` (such as `qt1-s` and `qt1-e`) have an empty closing marker:
   *
   * ```usfm
   * \qt1-s\*
   * ...
   * \qt1-e\*
   * ```
   *
   * The closing marker for `qt1-s` is `\*` as opposed to the closing marker for `nd` which is `\nd*`.
   *
   * If not present, defaults to `false`
   */
  isClosingMarkerEmpty?: boolean;
};

/**
 * Information about a USFM/USX/USJ marker type that does not have a closing marker. See {@link MarkerInfo}
 * for other kinds of marker types.
 * 
 * For example, `char` marker types such as `nd` markers have closing markers, but `para` marker types such
 * as `p` do not:
 *
 * ```usfm
 * \p This is a plain paragraph.
 * \p This is a paragraph \nd with some special text\nd* in it.
 * ```
 *
 * If the marker type has a closing marker but the closing marker is not present in the USFM for a marker
 * with this marker type, the USX/USJ for the marker will have the attribute `closed` set to `false` unless
 * {@link CloseableMarkerTypeInfo.isClosingMarkerOptional} is `true`.
 */
export type NonCloseableMarkerTypeInfo = MarkerTypeInfoBase & {
  /**
   * Whether markers of this type need a closing marker in USFM.
   *
   * If not present, defaults to `false`
   */
  hasClosingMarker?: false;
};

/**
 * Information about a USFM/USX/USJ marker type that is common to all marker types. See {@link MarkerTypeInfo}
 * for various kinds of marker types.
 */
export type MarkerTypeInfoBase = {
  /**
   * Whether markers of this type should have a `style` attribute in USX/USJ.
   *
   * If this is `false`, it also means the marker type is the same as the marker name.
   *
   * If not present, defaults to `true`.
   */
  hasStyleAttribute?: boolean;
  /**
   * List of attributes that should not be output to USFM on markers of this type.
   *
   * This is used for attributes that are not present in USFM. For example, the `sid` attribute on the
   * `verse` type marker is not present in USFM because it is derived metadata in USX/USJ and is not present in USFM.
   *
   * This property is not used when converting to USX or USJ.
   */
  skipOutputAttributeToUsfm?: string[];
  /**
   * List of attributes indicating whether to skip outputting this marker to USFM. If any of the listed
   * attributes is present on the marker, skip outputting this marker when converting to USFM.
   *
   * This is used for markers with attributes that are not present in USFM. For example, if the `verse`
   * marker has an `eid` attribute, it indicates it is a closing marker that is derived metadata in USX/USJ
   * and is not present in USFM. Note that the `verse` marker does not have the `style="v"` attribute in this
   * situation, so this list of attributes is on the marker type.
   *
   * This property is not used when converting to USX or USJ.
   */
  skipOutputMarkerToUsfmIfAttributeIsPresent?: string[];
  /**
   * Whether markers of this type need a newline before them in USFM.
   *
   * For example, `para` marker types such as `p` require a newline, but `char` marker types such as `nd`
   * markers do not:
   *
   * ```usfm
   * \p This is a plain paragraph.
   * \p This is a paragraph \nd with some special text\nd* in it.
   * ```
   *
   * Note that the newline is not necessarily present for the very first marker in examples such as this
   * one. This is just a shortcut to make examples like this easier to read and write.
   *
   * If not present, defaults to `false`
   */
  requiresNewlineBefore?: boolean;
};

/** Information about a USFM/USX/USJ marker type that is essential for proper translation between formats */
export type MarkerTypeInfo = CloseableMarkerTypeInfo | NonCloseableMarkerTypeInfo;

/** A map of all USFM/USX/USJ markers and some information about them */
export type MarkersMap = {
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
  markerTypes: Record<string, MarkerTypeInfoBase>;
};

/** A map of all USFM/USX/USJ markers and some information about them. Generated from a `usx.rng` file */
export const USFM_MARKERS_MAP = '%USFM_MARKERS_MAP_REPLACE_ME%';
