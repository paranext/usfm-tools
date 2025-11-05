/**
 * Information about a USFM marker that is just an attribute in USX/USJ. See {@link MarkerInfo} for
 * other kinds of markers.
 *
 * An attribute marker is a marker that adds information to a previous marker in USFM and is an
 * attribute on that previous marker instead in USX/USJ.
 *
 * @example `ca` and `cp` are attribute markers for `c`. `va` and `vp` are attribute markers for
 * `v`. `cat` is an attribute marker for `f`, `esb`, and more.
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
 * <!-- prettier-ignore -->
 * <chapter number="1" style="c" altnumber="2" pubnumber="A" sid="GEN 1" />
 * <para style="s1">This is a section header</para>
 * ```
 */
export type AttributeMarkerInfo = NormalMarkerInfo & {
  /**
   * List of normal marker names for which this marker is an attribute marker.
   *
   * @example `ca` and `cp` are attribute markers for `c`. `isAttributeMarkerFor` would be `['c']`
   * for both `ca` and `cp`.
   */
  isAttributeMarkerFor?: string[];
  /**
   * List of RegExp patterns matching marker names for which this marker is an attribute marker.
   *
   * @example Pretend `ex1` and `ex2` are attribute markers for markers matching RegExp `/test/`.
   * `isAttributeMarkerForRegExp` would be `['test']` for both `ex1` and `ex2`.
   */
  isAttributeMarkerForRegExp?: string[];
  /**
   * The name of the USX/USJ attribute this attribute marker represents.
   *
   * @example `ca` is an attribute marker for `c` and represents the `altnumber` attribute on the
   * `c` marker in USX/USJ. `attributeMarkerAttributeName` would be `altnumber` for the `ca`
   * marker.
   */
  attributeMarkerAttributeName: string;
  /**
   * Whether there should be a structural space after the closing marker in output USFM if this
   * marker is an attribute marker. If this marker is not an attribute marker, it should not have a
   * structural space after the closing marker.
   *
   * This field should be ignored if {@link MarkersMap.isSpaceAfterAttributeMarkersContent} is `true`
   * because this space is only supposed to be added in contexts in which the space here is
   * structural. Otherwise we would be mistakenly adding content to the USFM.
   *
   * Note that, if {@link MarkersMap.isSpaceAfterAttributeMarkersContent} is `false` (which is the
   * case according to spec), horizontal spaces after attribute markers are always considered
   * structural; this property only indicates whether there should be a space after the attribute
   * marker when outputting USFM as opposed to parsing it.
   *
   * If not present or `undefined`, defaults to `false`.
   *
   * @example According to specification, the `va` and `vp` attribute markers have a space after
   * their closing markers:
   *
   * ```usfm
   * \p \v 10 \va 10 va\va* \vp 10 vp\vp* Some verse text
   * ```
   *
   * The verse text in this example is just "Some verse text" without a space at the start.
   *
   * However, when the `vp` marker is not an attribute marker, such as when it has markers in its
   * contents, there should not be a structural space after the closing marker, and any space should
   * be considered content:
   *
   * ```usfm
   * \p \v 10 \va 10 va\va* \vp \+wj 10 vp\+wj*\vp* Some verse text.
   * ```
   *
   * The verse text in this example is " Some verse text" including a space at the start.
   *
   * @example The `cat` attribute marker does not have a structural space after its closing marker:
   *
   * ```usfm
   * \f + \cat category here\cat*\fr 1:2 \ft Some footnote text\f*
   * ```
   *
   * The verse text in this example is just "Some verse text" without a space at the start.
   */
  hasStructuralSpaceAfterCloseAttributeMarker?: boolean;
};

/**
 * Information about a regular USFM/USX/USJ marker. See {@link MarkerInfo} for other kinds of
 * markers.
 */
export type NormalMarkerInfo = {
  /**
   * Which marker type the marker is. Determines how the marker is structured in the data such as
   * what kind of mandatory whitespace is around the marker in USFM. See {@link MarkerTypeInfoBase}
   * for information.
   */
  type: string;
  /** Explanation of the meaning of this marker */
  description?: string;
  /**
   * Which attribute can be provided without specifying the attribute name in USFM.
   *
   * A marker can have a default attribute only if it has zero or one non-optional attributes.
   *
   * An attribute can be provided with default syntax in the USFM only if it is the only attribute
   * provided for the marker.
   *
   * @example A marker with a default attribute:
   *
   * ```usfm
   * \w stuff|thisIsTheLemmaDefaultAttribute\w*
   * ```
   *
   * @example A marker with multiple attributes (cannot use default attribute syntax):
   *
   * ```usfm
   * \w stuff|lemma="thisIsTheLemma" strong="H1234,G1234"\w*
   * ```
   */
  defaultAttribute?: string;
  /**
   * The name of the text content attribute that is present on this marker if this marker has text
   * content in USFM.
   *
   * Text content attributes are attributes in USX/USJ that are represented in USFM as the actual
   * text content of the marker.
   *
   * @example `alt` is a text content attribute on the `periph` marker. This value would be `alt`
   * for the `periph` marker.
   *
   * Following is an example of a `periph` marker in USFM:
   *
   * ```usfm
   * \periph Example Peripheral|id="x-example"
   * \p Some contents of the example peripheral
   * ```
   *
   * The equivalent in USX would be:
   *
   * ```xml
   * <!-- prettier-ignore -->
   * <periph alt="Example Peripheral" id="x-example">
   *   <para style="p">Some contents of the example peripheral</para>
   * </periph>
   * ```
   */
  textContentAttribute?: string;
  /**
   * List of leading attributes that must be present on this marker. This list is ordered by the
   * order in which the attributes should appear.
   *
   * Leading attributes are attributes in USJ/USX that are listed in USFM directly after the marker
   * and separated only by a space.
   *
   * @example `code` is a leading attribute on the `id` marker. This value would be `['code']` for
   * the `id` marker.
   *
   * Following is an example of an `id` marker in USFM:
   *
   * ```usfm
   * \id MAT 41MATEX.SFM, Example Translation, September 2025
   * ```
   *
   * The equivalent in USX would be:
   *
   * ```xml
   * <!-- prettier-ignore -->
   * <book code="MAT" style="id">41MATEX.SFM, Example Translation, September 2025</book>
   * ```
   */
  leadingAttributes?: string[];
  /**
   * List of attribute markers that may be present on this marker. This list is ordered by the order
   * in which the markers should appear.
   *
   * An attribute marker is a marker that adds information to a previous marker in USFM and is an
   * attribute on that previous marker in USX/USJ.
   *
   * Note: the attribute names for attribute markers may be different than the marker names. See
   * {@link AttributeMarkerInfo.attributeMarkerAttributeName} for more information.
   *
   * @example `ca` and `cp` are attribute markers for `c`. This value would be `['ca', 'cp']` for
   * `c`.
   */
  attributeMarkers?: string[];
  /**
   * Whether the closing marker for this marker is considered optional in USFM. This should always
   * be not present or `false` if there is no closing marker for the marker type of this marker.
   *
   * If this is `false` and a closing marker for this marker in USFM is _not_ present, the USX/USJ
   * for this marker should have the attribute `closed` set to `false`.
   *
   * If this is `true`, the `closed` attribute should be present if the presence of a closing marker
   * for this marker in USFM does not match the assumption implied by
   * {@link MarkersMap.shouldOptionalClosingMarkersBePresent}.
   *
   * If not present or `undefined`, defaults to `false`
   */
  isClosingMarkerOptional?: boolean;
  /**
   * List of independent closing marker names for this marker in USFM if it has any. If this is
   * defined, this marker does not have a normal closing marker but rather is closed by a completely
   * separate marker in USFM. All contents between this marker and the independent closing marker
   * are contents of this marker. In USX and USJ, this marker is closed normally like any other
   * object because USX and USJ have clear hierarchical structure.
   *
   * Note that independent closing markers do not have a `*` at the end because they are not normal
   * closing marker for but rather are completely separate markers that close the corresponding
   * opening marker.
   *
   * @example `esb` (a sidebar) is closed by the independent closing marker `esbe`.
   * `independentClosingMarkers` would be `['esbe']` for `esb`. Following is an example of a
   * sidebar:
   *
   * ```usfm
   * \esb
   * \p This paragraph is in a \bd sidebar\bd*.
   * \p The sidebar can contain multiple paragraphs.
   * \esbe
   * ```
   */
  independentClosingMarkers?: string[];
  /**
   * List of marker names for which this marker is an independent closing marker. See
   * {@link NormalMarkerInfo.independentClosingMarker} for more information on independent closing
   * markers and their syntax.
   *
   * @example `esbe` is an independent closing marker for `esb`. `isIndependentClosingMarkerFor`
   * would be `['esb']` for `esbe`.
   */
  isIndependentClosingMarkerFor?: string[];
  /**
   * List of RegExp patterns matching marker names for which this marker is an independent closing
   * marker. See {@link NormalMarkerInfo.independentClosingMarker} for more information on
   * independent closing markers and their syntax.
   *
   * @example Pretend `ex1` and `ex2` are independent closing markers for markers matching RegExp
   * `/test/`. `isIndependentClosingMarkerForRegExp` would be `['test']` for both `ex1` and `ex2`.
   */
  isIndependentClosingMarkerForRegExp?: string[];
  /**
   * Marker to use when operating on the USFM representation of this marker. For example, when
   * outputting to USFM, the marker info for the marker listed here in `markerUsfm` should be used
   * instead of the marker info for the marker as listed in USX or USJ.
   *
   * @example When the `usx` marker is output to USFM, it should be transformed to the `usfm`
   * marker.
   */
  markerUsfm?: string;
  /**
   * Instructions written in plain text regarding special handling required for this marker when
   * transforming from USFM to USX or USJ. These instructions are an explanation of what needs to be
   * done to this marker to properly transform it to USX or USJ.
   *
   * This property is generally only included when it is exceptionally difficult to parse a marker
   * properly from USFM; the markers map attempts to use this property as little as possible,
   * favoring encoding information in other properties for more automatic transformation instead.
   */
  parseUsfmInstructions?: string;
};

/**
 * Information about a USFM/USX/USJ marker that is essential for proper translation between formats.
 *
 * @example `w` is a `char`-type marker, so it shares the characteristics of the `char`
 * {@link MarkerTypeInfo} with other `char`-type markers and has its own set of characteristics.
 * `w`'s `MarkerInfo` is as follows:
 *
 * ```json
 * {
 *   "type": "char",
 *   "defaultAttribute": "lemma"
 * }
 * ```
 */
export type MarkerInfo = NormalMarkerInfo | AttributeMarkerInfo;

/**
 * Information about a USFM/USX/USJ marker type that has a closing marker. See {@link MarkerTypeInfo}
 * for other kinds of marker types.
 *
 * If the marker type has a closing marker but the closing marker is not present in the USFM for a
 * marker with this marker type, the USX/USJ for the marker will have the attribute `closed` set to
 * `false` unless {@link NormalMarkerInfo.isClosingMarkerOptional} is `true`.
 *
 * @example `char` marker types such as `nd` markers have closing markers, but `para` markers such
 * as `p` do not:
 *
 * ```usfm
 * \p This is a plain paragraph.
 * \p This is a paragraph \nd with some special text\nd* in it.
 * ```
 */
export type CloseableMarkerTypeInfo = MarkerTypeInfoBase & {
  /**
   * Whether markers of this type have a closing marker in USFM. This property concerns normal
   * closing markers like `\wj*`, not independent closing markers like
   * {@link NormalMarkerInfo.independentClosingMarkers}, which are completely separate markers.
   *
   * If not present or `undefined`, defaults to `false` (meaning this `MarkerTypeInfo` is a
   * {@link NonCloseableMarkerTypeInfo}, not a {@link CloseableMarkerTypeInfo})
   */
  hasClosingMarker: true;
  /**
   * Whether the closing marker for markers of this type is "empty" in USFM, meaning the marker name
   * is absent from the closing marker. This also means that there should not be a structural space
   * between the opening and the closing markers in USFM if there are no attributes listed on the
   * marker.
   *
   * If not present or `undefined`, defaults to `false`
   *
   * @example Markers of type `ms` (such as `qt1-s` and `qt1-e`) have an empty closing marker:
   *
   * ```usfm
   * \qt1-s\*
   * ...
   * \qt1-e\*
   * ```
   *
   * The closing marker for `qt1-s` is `\*` as opposed to the closing marker for `nd` which is
   * `\nd*`.
   *
   * Note that there is still a structural space after the opening marker if there are attributes
   * present:
   *
   * ```usfm
   * \qt1-s |Someone\*
   * ...
   * \qt1-e\*
   * ```
   */
  isClosingMarkerEmpty?: boolean;
};

/**
 * Information about a USFM/USX/USJ marker type that does not have a closing marker. See
 * {@link MarkerTypeInfo} for other kinds of marker types.
 *
 * @example `char` marker types such as `nd` markers have closing markers, but `para` marker types
 * such as `p` do not:
 *
 * ```usfm
 * \p This is a plain paragraph.
 * \p This is a paragraph \nd with some special text\nd* in it.
 * ```
 */
export type NonCloseableMarkerTypeInfo = MarkerTypeInfoBase & {
  /**
   * Whether markers of this type have a closing marker in USFM. This property concerns normal
   * closing markers like `\wj*`, not independent closing markers like
   * {@link NormalMarkerInfo.independentClosingMarkers}, which are completely separate markers.
   *
   * If not present or `undefined`, defaults to `false` (meaning this `MarkerTypeInfo` is a
   * {@link NonCloseableMarkerTypeInfo}, not a {@link CloseableMarkerTypeInfo})
   */
  hasClosingMarker?: false;
};

/**
 * Information about a USFM/USX/USJ marker type that is common to all marker types. See
 * {@link MarkerTypeInfo} for various kinds of marker types.
 */
export type MarkerTypeInfoBase = {
  /** Explanation of the meaning of this marker type */
  description?: string;
  /**
   * Whether markers of this type should have a `style` attribute in USX/USJ.
   *
   * If this is `false`, it also means the marker type is the same as the marker name.
   *
   * If not present or `undefined`, defaults to `true`.
   */
  hasStyleAttribute?: boolean;
  /**
   * List of attributes that should not be output to USFM on markers of this type.
   *
   * This is used for attributes that are not present in USFM.
   *
   * This property is not used when converting to USX or USJ.
   *
   * @example The `sid` attribute on the `verse` type marker is not present in USFM because it is
   * derived metadata in USX/USJ and is not present in USFM.
   */
  skipOutputAttributeToUsfm?: string[];
  /**
   * List of attributes indicating whether to skip outputting this marker to USFM. If any of the
   * listed attributes is present on the marker, skip outputting this marker when converting to
   * USFM. Only skip outputting the opening and closing marker representations, though; the content
   * inside the marker (if present) should not be skipped.
   *
   * This is used for certain markers that sometimes are normal markers but sometimes are derived
   * metadata and are not present in USFM. These derived metadata markers are identified by whether
   * they have specific attributes on them.
   *
   * This property is not used when converting to USX or USJ.
   *
   * @example If the `verse` marker has an `eid` attribute, it indicates it is a marker denoting the
   * end of the verse that is derived metadata in USX/USJ and is not present in USFM. Note that the
   * `verse` marker does not have the `style="v"` attribute in this situation, so this list of
   * attributes is on the marker type.
   *
   * Following is an example of a derived metadata `verse` marker in USX:
   *
   * ```xml
   * <!-- prettier-ignore -->
   * <para style="p">
   *   <verse number="21" style="v" sid="2SA 1:21" />This is verse 21.<verse eid="2SA 1:21" />
   * </para>
   * ```
   *
   * The equivalent in USFM would be:
   *
   * ```usfm
   * \p
   * \v 21 This is verse 21.
   * ```
   *
   * @example Generated `ref`s should be skipped but have content inside the marker that should not
   * be skipped. These `ref`s wrap project-localized Scripture references in `xt` markers and have
   * computer-readable Scripture References as their `loc` attribute. These `ref`s that are derived
   * metadata have the `gen` attribute set to `"true"` and can be removed if `gen="true"` is
   * present.
   *
   * Following is an example of a generated `ref` in USX:
   *
   * ```xml
   * <!-- prettier-ignore -->
   * <char style="xt"><ref loc="2SA 1:1" gen="true">2Sam 1:1</ref>; <ref loc="2SA 1:2-3">2Sam 1:2-3</ref>.</char>
   * ```
   *
   * The equivalent in USFM would be:
   *
   * ```usfm
   * \xt 2Sam 1:1; 2Sam 1:2-3.\xt*
   * ```
   */
  skipOutputMarkerToUsfmIfAttributeIsPresent?: string[];
  /**
   * Whether to always skip outputting this marker when converting to USFM. Only skip outputting the
   * opening and closing marker representations, though; the content inside the marker (if present)
   * should not be skipped.
   *
   * This is used for marker types that have no representation in USFM in a given version, likely
   * meaning they are derived metadata and are not present in USFM.
   *
   * This property is not used when converting to USX or USJ.
   *
   * If not present or `undefined`, defaults to `false`
   *
   * @example In USFM 3.1, the `table` marker type is generated while transforming USFM into USX/USJ
   * and is not preserved when transforming from USX/USJ to USFM.
   *
   * Following is an example of a derived metadata `table` marker in USX:
   *
   * ```xml
   * <!-- prettier-ignore -->
   * <table>
   *   <row style="tr">
   *     <cell style="th1" align="start">Header 1</cell>
   *     <cell style="th2" align="start">Header 2 space after </cell>
   *     <cell style="thc3" align="center" colspan="2">Header 3-4 centered</cell>
   *     <cell style="thr5" align="end">Header 5 right</cell>
   *   </row>
   *   <row style="tr">
   *     <cell style="tc1" align="start">Row 1 cell 1</cell>
   *     <cell style="tc2" align="start">Row 1 cell 2 space after </cell>
   *     <cell style="thc3" align="center">Row 1 cell 3 centered</cell>
   *     <cell style="thr4" align="end" colspan="2">Row 1 cell 4-5 right</cell>
   *   </row>
   *   <row style="tr">
   *     <cell style="tcr1" align="end" colspan="4">Row 2 cell 1-4 right</cell>
   *     <cell style="tc5" align="start">Row 2 cell 5</cell>
   *   </row>
   * </table>
   * ```
   *
   * The equivalent in USFM would be:
   *
   * ```usfm
   * \tr \th1 Header 1\th2 Header 2 space after \thc3-4 Header 3-4 centered\thr5 Header 5 right
   * \tr \tc1 Row 1 cell 1\tc2 Row 1 cell 2 space after \thc3 Row 1 cell 3 centered\thr4-5 Row 1 cell 4-5 right
   * \tr \tcr1-4 Row 2 cell 1-4 right\tc5 Row 2 cell 5
   * ```
   */
  skipOutputMarkerToUsfm?: boolean;
  /**
   * Whether markers of this type should have a newline before them in USFM.
   *
   * Note that the newline is never strictly necessary, and it is not usually present if the very
   * first marker in the file (or in examples such as the following example) should have a newline.
   *
   * If not present or `undefined`, defaults to `false`
   *
   * @example `para` marker types such as `p` should have a newline, but `char` marker types such as
   * `nd` markers should not:
   *
   * ```usfm
   * \p This is a plain paragraph.
   * \p This is a paragraph \nd with some special text\nd* in it.
   * ```
   */
  hasNewlineBefore?: boolean;
  /**
   * Marker type to use when operating on the USFM representation of markers of this type. For
   * example, when outputting to USFM, the marker type listed here in `markerTypeUsfm` should be
   * used instead of the marker's type as listed in USX or USJ.
   */
  markerTypeUsfm?: string;
  /**
   * Marker type to use when operating on the USX representation of markers of this type. For
   * example, when outputting to USX, the marker type listed here in `markerTypeUsx` should be used
   * instead of the marker's type as listed in USFM or USJ.
   */
  markerTypeUsx?: string;
  /**
   * Marker type to use when operating on the USJ representation of markers of this type. For
   * example, when outputting to USJ, the marker type listed here in `markerTypeUsj` should be used
   * instead of the marker's type as listed in USFM or USX.
   */
  markerTypeUsj?: string;
  /**
   * Prefix to add to the opening and closing marker before the marker name if a marker of this type
   * occurs within another marker of this type when outputting to USFM.
   *
   * @example In USFM 3.0, `char`-type markers that are nested must have a `+` prefix. Following is
   * an example of `nd` inside `wj` (both are `char`-type markers) in USFM:
   *
   * ```usfm
   * \p \wj This is \+nd nested\+nd*!\wj*
   * ```
   */
  nestedPrefix?: string;
  /**
   * Instructions written in plain text regarding special handling required for this marker type
   * when transforming to USFM. These instructions are an explanation of what needs to be done to
   * markers of this type to properly transform the marker to USFM.
   *
   * This property is generally only included when it is exceptionally difficult to output a marker
   * properly to USFM; the markers map attempts to use this property as little as possible, favoring
   * encoding information in other properties for more automatic transformation instead.
   */
  outputToUsfmInstructions?: string;
  /**
   * Instructions written in plain text regarding special handling required for this marker type
   * when transforming from USFM to USX or USJ. These instructions are an explanation of what needs
   * to be done to markers of this type to properly transform the marker to USX or USJ.
   *
   * This property is generally only included when it is exceptionally difficult to parse a marker
   * properly from USFM; the markers map attempts to use this property as little as possible,
   * favoring encoding information in other properties for more automatic transformation instead.
   */
  parseUsfmInstructions?: string;
};

/**
 * Information about a USFM/USX/USJ marker type that is essential for proper translation between
 * formats.
 *
 * @example `char` is a marker type, which means markers like `w` whose marker type is `char` share
 * some characteristics, and each marker also has its own set of characteristics which are presented
 * with type {@link MarkerInfo}. `char`'s `MarkerTypeInfo` is as follows:
 *
 * ```json
 * {
 *   "hasClosingMarker": true,
 *   "nestedPrefix": "+"
 * }
 * ```
 */
export type MarkerTypeInfo = CloseableMarkerTypeInfo | NonCloseableMarkerTypeInfo;

/** A map of all USFM/USX/USJ markers and some information about them */
export type MarkersMap = {
  /** Which version of USFM/USX/USJ this map represents */
  version: string;
  /** Which repository this map came from. */
  schemaRepo: string;
  /**
   * Which commit this map came from. This is necessary because the schema file seems to be
   * distributed multiple times in one release version. As such, this specifies the exact version of
   * the schema file.
   */
  schemaCommit: string;
  /**
   * Which version of the markers map types this markers map conforms to. Follows [Semantic
   * versioning](https://semver.org/); the same major version contains no breaking changes.
   */
  markersMapVersion: `1.${number}.${number}${string}`;
  /**
   * Which tag or commit in the `https://github.com/paranext/usfm-tools` repo this map is generated
   * from.
   *
   * Contains the output from `git tag --points-at HEAD` or `git rev-parse HEAD`
   *
   * Will also have a `+` at the end if there were working changes outside the `src/test-data`
   * folder when this was generated.
   */
  usfmToolsCommit: string;
  /**
   * Whether any whitespace after attribute markers and before the next content is not just
   * structural but should actually be considered part of the content of the marker.
   *
   * Structural whitespace is whitespace in the USFM that is required as part of the USFM syntax and
   * usually acts as a delimiter between markers and other things. Content whitespace is whitespace
   * in USFM that is part of the actual Scripture text or the "content" of the marker.
   *
   * According to specification, whitespace after attribute markers is not content but is just
   * structural.
   *
   * According to Paratext 9.4, whitespace after attribute markers is content and is not just
   * structural.
   *
   * This setting determines which interpretation to use when converting from USFM to USX/USJ.
   *
   * If not present or `undefined`, defaults to `false`.
   */
  isSpaceAfterAttributeMarkersContent?: boolean;
  /**
   * Whether markers with optional closing markers (see
   * {@link NormalMarkerInfo.isClosingMarkerOptional}) should still be explicitly closed in USFM.
   * That is, whether markers with optional closing markers still need the `closed` attribute set to
   * `"false"` in USX/USJ if the closing marker is not present in USFM.
   *
   * In other words, this setting determines whether markers with optional closing markers should be
   * assumed to be explicitly closed (meaning the closing marker is present in USFM) when
   * transforming USX/USJ to USFM unless otherwise indicated by the `closed` attribute.
   *
   * If this is `true` (matches Paratext 9.4), markers with optional closing markers are treated
   * like other markers in that they are assumed to be explicitly closed in USFM unless otherwise
   * indicated:
   *
   * - If they are not explicitly closed in USFM, they should have `closed="false"`
   * - If they are explicitly closed in USFM, they do not need `closed="true"`
   *
   * If this is `false` (matches specification), markers with optional closing markers are assumed
   * not to be explicitly closed in USFM unless otherwise indicated:
   *
   * - If they are not explicitly closed in USFM, they do not need `closed="false"`
   * - If they are explicitly closed in USFM, they should have `closed="true"`
   *
   *   - Disclaimer: It is not clear that `closed="true"` should be present in this case according to
   *       `usx.rng`; it seems `usx.rng` indicates that optional closing markers should never be
   *       output to USFM. It is possible that `usx.rng` considers this to be a case where
   *       preserving the exact USFM is not important.
   *
   * If not present or `undefined`, defaults to `false`.
   */
  shouldOptionalClosingMarkersBePresent?: boolean;
  /**
   * Map whose keys are the marker names and whose values are information about that marker
   *
   * If you find the marker name in this map, you do not need to search the `markersRegExp` map.
   */
  markers: Record<string, MarkerInfo | undefined>;
  /**
   * Map whose keys are string representations of `RegExp` patterns to match against marker names
   * (using the
   * [test](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test)
   * function) and whose values are information about that marker
   *
   * You do not need to search this map if you found the marker name in the `markers` map.
   */
  markersRegExp: Record<string, MarkerInfo | undefined>;
  /** Map whose keys are the marker types and whose values are information about that marker type */
  markerTypes: Record<string, MarkerTypeInfo | undefined>;
};

// This function should safely freeze anything, but TypeScript doesn't understand.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFreeze(o: any) {
  Object.freeze(o);
  // Don't want to crash out on null
  // eslint-disable-next-line no-null/no-null
  if (o === undefined || o === null) {
    return o;
  }

  Object.getOwnPropertyNames(o).forEach(function freezeProperty(prop) {
    if (
      // Need to make sure to avoid null, which is an object type
      // eslint-disable-next-line no-null/no-null
      o[prop] !== null &&
      (typeof o[prop] === 'object' || typeof o[prop] === 'function') &&
      !Object.isFrozen(o[prop])
    ) {
      deepFreeze(o[prop]);
    }
  });

  return o;
}

/**
 * A map of all USFM/USX/USJ markers and some information about them. Generated from a `usx.rng`
 * file
 */
export const USFM_MARKERS_MAP: MarkersMap = deepFreeze(JSON.parse('%USFM_MARKERS_MAP_REPLACE_ME%'));

/**
 * A map of all USFM/USX/USJ markers and some information about them. Generated from a `usx.rng`
 * file and adjusted to reflect the way Paratext 9.4 handles USFM.
 */
export const USFM_MARKERS_MAP_PARATEXT: MarkersMap = Object.freeze({
  ...USFM_MARKERS_MAP,
  isSpaceAfterAttributeMarkersContent: true,
  shouldOptionalClosingMarkersBePresent: true,
});
