# usfm-tools

Scripts and utilities for transforming and preparing US\* schemas for use in Platform.Bible and Paratext

## Setup

To get started with this repo, first clone the repo:

```
git clone https://github.com/paranext/usfm-tools.git
```

Then install dependencies:

```
npm i
```

## Terminology

In this repo, there are some terms used that are rather precise and specific to USFM and others that do not necessarily match with official terminology (including some newly coined terms where there are not known terms). There is lots of documentation in `src/markers-map.model.template.ts`. Here is a short list of terms and definitions for clarity:

- Attributes - key/value pairs (or, in some cases in USFM, just values because the key is implied via USFM syntax) on a marker that provide some information about that marker
  - USFM attributes - key/value pairs or values whose keys are implied that add information to markers but are not essential information about how to represent a marker in USFM. For example, `caller`, `lemma`, and `code` are USFM attributes, but `style` (the marker name in USX) and `closed` (a USX attribute and USJ property that indicates whether the marker has a closing marker in USFM) are not USFM attributes but are only found in other formats and are used to represent the marker itself in USFM.
  - USX/XML attributes - [XML attributes](https://www.geeksforgeeks.org/software-engineering/xml-attributes/) on an XML element. Some of these (like `caller` or `lemma`) are USFM attributes while others (like `style` or `closed`) are other kinds of information that are not represented as attributes in USFM
  - USJ/JSON properties/attributes - a term sometimes used for each key/value pair in [JSON objects](https://json-schema.org/understanding-json-schema/reference/object). Some of these (like `caller` or `lemma`) are USX attributes and USFM attributes. Others (like `style` in USX, which equates to `marker` in USJ, and `closed`) are USX attributes but are not USFM attributes. Others (like `content`) are other kinds of information that are not represented as attributes in USFM or USX.
- `usx.rng` `attribute` - XML elements with tag name `attribute` in `usx.rng`. These are not like the attributes described above because these are XML elements in [RelaxNG specification](https://relaxng.org/spec-20011203.html) that describe USX attributes.
- USFM Attribute types - different ways attributes are represented in USFM. Each USFM attribute has its own attribute type, and these types do not apply to USX or USJ (they are all normal USX attributes and USJ properties).
  - Closing marker attributes - attributes that are listed attached to the closing marker e.g. `lemma` on `w` marker. These look like `\marker content|attributeKey="attributeValue" otherAttributeKey="otherAttributeValue"\marker*`
    - Default attribute - an attribute that, if it is the only closing marker attribute for a marker, can be listed without the attribute key e.g. `gloss` on `rb`. These look like `\marker content|defaultAttributeValue\marker*`
  - Special attribute types - attributes in USX/USJ that are not just listed on the closing marker but are represented in some other way in USFM. None of these have the attribute key listed in USFM.
    - Attribute marker - separate markers that appear after the marker they describe in USFM e.g. `altnumber` on `c` is `ca`. These look like `\marker content \attributeMarker attributeValue`
    - Text content attribute - the actual text content of the marker in USFM. e.g. `alt` on `periph`. These look like `\marker content`.
    - Leading attribute - text that is added right after the opening marker and before the text content of the marker e.g. `caller` on `f`. These look like `\marker leadingAttribute content`
- `usx.rng` `element` - XML elements with tag name `element` in `usx.rng`. These XML elements are from [RelaxNG specification](https://relaxng.org/spec-20011203.html) and are used to describe markers and/or marker types.
- `usx.rng` `define` - XML elements with tag name `define` in `usx.rng`. These XML elements are from [RelaxNG specification](https://relaxng.org/spec-20011203.html) and are used to describe some set of information that is referred to somewhere else in `usx.rng`. Usually, these `define`s contain one or more `element`s, so they describe one or more markers and/or marker types.
- Closing marker - the USFM representation of the end of a marker. USX and USJ markers just use their equivalent XML/JSON syntax for the closing of an element/object.
  - Normal closing marker - a closing marker that uses the same marker name as the opening marker and just have an asterisk at the end e.g. `\nd*` for `nd`. These look like `\marker*`.
  - Independent closing marker - a closing marker that uses a different marker name than the opening marker and does not have an asterisk added at the end e.g. `\esbe` for `esb`. These look like `\closingMarker`.
- Specification/spec - the official ruling about how USFM/USX/USJ should look. This is found at https://docs.usfm.bible/usfm/3.1/index.html
- [Whitespace](https://en.wikipedia.org/wiki/Whitespace_character)
  - Structural whitespace - whitespace in USFM that is required part of the USFM syntax and delimits different things e.g. normal space after opening markers. This looks like `\marker content`
  - Content whitespace - whitespace in USFM that is part of the actual Scripture text or the "content" of the marker. This looks like `\marker here is some content with content whitespace in it`
  - Normalization - the process of transforming USFM with any whitespace into USFM with specific whitespace based on a set of rules. Many different USFM representations of the same Scripture content should be able to be normalized into the same USFM string. Paratext has its own rules for normalizing whitespace, and the specification has its own rules that result in the canonical form.
  - Canonical form - the official representation of how USFM should look based on the rules described by the specification. The whitespace should be [normalized or "reduced" according to the rules in the specification](https://docs.usfm.bible/usfm/3.1/whitespace.html#ws-reducing).

## Markers Map

The markers map is a JSON file that contains information for each USFM marker and marker type. It aims to include all necessary marker-specific information for translating from USJ to USFM that is not about the generic syntax of USFM.

See [`UsjReaderWriter`](https://github.com/paranext/paranext-core/blob/main/lib/platform-bible-utils/src/scripture/usj-reader-writer.ts) for an example of using this markers map to transform USJ to USFM as well as to convert locations between USFM and USJ space.

The markers map does not contain the following information necessary for perfectly transforming USJ to USFM:

- There are a few properties on markers that should not be output to USFM as USFM attributes but rather should be incorporated in other ways. The use of these properties is partially or wholly not represented in the markers map
  - `style`/`marker` (the marker name in USX/USJ)
  - the XML element tag/`type` (the marker type in USX/USJ)
  - the XML element children/`content` (the contents of the marker in USX/USJ)
  - `closed` (whether the marker should be explicitly closed in USFM)
  - Note: In USFM 3.1, the `+` prefix for nested character markers is optional, but the markers map does not currently expect or have instructions on how to handle any special information to preserve whether or not this prefix is present.
- The `v` marker (`verse` type) canonically has a newline before it. However, Paratext 9.4 does not add a newline before it if it comes after `(` or `[`.
- The `optbreak` marker is transformed to two slashes in a row `//` in USFM
- Non-breaking space (`NBSP`/`U+00A0`) should be converted to `~` in USFM
- General, simple rules about how canonical USFM is structured. Some examples:
  - There is a backslash before each marker name (except in certain circumstances when indicated by `markerType.isClosingMarkerEmpty`) and a space after each marker name (except in non-standard circumstances when indicated by `markerType.noSpaceAfterOpening`) e.g. `\nd `
  - There is an asterisk before normal closing markers e.g. `\nd*`
  - Newlines before markers as indicated by `markerType.hasNewlineBefore` replace space after the last content before the marker
  - Attributes that are not special attribute types or skipped are listed at the end of the marker after a bar `|` in the form `key="value"` with spaces between multiple attributes.
  - See [`UsjReaderWriter.toUsfm`](https://github.com/paranext/paranext-core/blob/main/lib/platform-bible-utils/src/scripture/usj-reader-writer.ts) to find the implementation of all general USFM rules.
- The spec seems to be silent regarding what should happen to unknown markers. In Paratext 9.4, markers whose type is `para` but the marker is unknown (meaning the marker info cannot be found or the marker `type` in the marker does not match the marker `type` listed in the marker info) do not have a newline before them when output to USFM contrary to normal `para`-type markers.
- The spec seems to be silent about unexpected closing markers. In Paratext 9.4, closing markers that have no matching opening marker are given the `unmatched` marker type. They have no contents. no closing markers, and no structural space after the marker.

The markers map also includes most information necessary for parsing USFM and translating from USFM to USJ, but it does not currently cover this use case or aim to cover it. Particularly, it does not contain the following information (there may be other gaps):

- When to close USFM markers
- Where to create the `table` marker that is currently derived in USX and USJ but is never in USFM
- Which whitespace is USFM structural whitespace that has no representation in USX/USJ and can be skipped
- When two slashes in a row `//` are found, this should be converted to the `optbreak` marker in USX/USJ
- When `~` is found, this should be converted to non-breaking space (`NBSP`/`U+00A0`) in USX/USJ.
- What to do about unknown markers (ones for which there is no marker info). Paratext 9.4 gives them the type `para`.
- What to do about unexpected closing markers (end with `*`). Paratext 9.4, closing markers that have no matching opening marker are given the `unmatched` marker type, have no contents, no closing markers, and no structural space after the marker.

### Generate Markers Map

Generate the markers map by placing the USX RelaxNG Schema file `usx.rng` (download the file on a release branch - [`usx.rng` < 3.1](https://github.com/ubsicap/usx/blob/master/schema/usx.rng) or [`usx.rng` >= 3.1](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng)) in the root of this repo and running `npm run generate-markers-map -- --schema usx.rng --version <schema-version> --commit <commit-hash>`. Note that the commit hash is the commit hash for the repo where you got `usx.rng`, _not_ the commit hash of this repo.

See the release notes and planned changes for USFM versions [in the Roadmap](https://github.com/usfm-bible/tcdocs/blob/main/docs/USFMTC%20Roadmap.md) and [in the Docs](https://docs.usfm.bible/usfm/latest/release-notes.html).

This script reads the USX RelaxNG Schema file [`usx.rng`](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng) and generates a JSON file `dist/markers.json` and a TypeScript file `dist/markers-map.model.ts` that contain various information for each USFM marker name. `markers.json` will contain an object with:

- information about the generated file (`version`, `commit`, `usfmToolsVersion`)
- the [Semantic version](https://semver.org/) of the markers map `markersMapVersion`. The same major version contains no breaking changes
- a `markers` property whose value is a map object
  - keys are the marker names
  - values are objects containing information about the marker such as the marker type and the marker's default attribute (where applicable)
- a `markersRegExp` property whose value is the same thing as `markers` but for markers whose names match the keys using RegExp
- a `markerTypes` property whose value is a map object
  - keys are the marker types
  - values are objects that are currently empty but may be filled with information about the marker types in the future
- other properties that slightly affect how the USJ is transformed to USFM that are different depending on what style of USFM you intend to generate, spec or Paratext 9.4 (`isSpaceAfterAttributeMarkersContent`, `shouldOptionalClosingMarkersBePresent`).

This object is also exported from `dist/markers-map.model.ts` as `USFM_MARKERS_MAP` (matching spec) and `USFM_MARKERS_MAP_PARATEXT` (matching Paratext 9.4). `dist/markers-map.model.ts` also contains TypeScript types relevant to this object.

Following is a simplified example of what you might see in a `markers.json` file:

```json
{
  "version": "5.2-test.123",
  "commit": "abc123",
  "markers": {
    "c": {
      "type": "chapter",
      "leadingAttributes": [
        "number"
      ],
      "attributeMarkers": [
        "ca",
        "cp"
      ]
    },
    "p": {
      "type": "para",
      "description": "Paragraph text, with first line indent"
    },
    "qt3-s": {
      "type": "ms",
      "defaultAttribute": "who"
    },
    ...
  },
  "markersRegExp": {
    "t[hc][rc]?\d+(-\d+)?": {
      "type": "cell"
    }
  },
  "markerTypes": {
    "cell": {
      "skipOutputAttributeToUsfm": [
        "align"
      ]
    },
    "chapter": {
      "hasNewlineBefore": true,
      "skipOutputAttributeToUsfm": [
        "sid"
      ],
      "skipOutputMarkerToUsfmIfAttributeIsPresent": [
        "eid"
      ]
    },
    "ms": {
      "hasClosingMarker": true,
      "isClosingMarkerEmpty": true
    },
    "para": {
      "hasNewlineBefore": true,
      "skipOutputAttributeToUsfm": [
        "vid"
      ]
    },
  }
}
```

### Transforming `usx.rng` into the markers map

<details>
    <summary>Expand to read about how the data in `usx.rng` is transformed into `markers.json`</summary>

The marker names and information about those markers are mostly derived from the `usx.rng` file. This schema file contains information about each valid USFM marker in the various `element` definitions:

- (`marker.type`; `markerTypes` keys) The element's `name` is the marker type
- Skip the definition if all `ref`s pointing to it are pointing to it via `usfm:alt` attribute instead of `name` (`FigureTwo`)
- Marker information:
  - (`markers` keys; `markersRegExp` keys) The marker name comes from one of a number of places:
    - The `style` attribute may contain the single marker name for that marker type
    - The `style` attribute may contain a `choice` of all the marker names associated with that marker type
    - The `style` attribute may contain a `ref` pointing to a `choice` of all the marker names associated with that marker type
    - If there is not a `style` attribute, the element's `name` is the marker type and the marker name
  - (`marker.isIndependentClosingMarkerFor`; `marker.independentClosingMarkers`) additional independent closing marker that goes with another other marker
    - Check for marker type element direct children `usfm:ptag` or `usfm:tag` with text content and create a simple marker (no attributes or whatnot from the other markers of this marker type) whose name is the text content of the tag. Like `esbe` in `sidebar` marker type
  - (`marker.isClosingMarkerOptional`) closing marker should not usually be output to USFM if the `usfm:endtag` has `noout="true"`
  - (`marker.description`) get comments of what the marker represents from `a:documentation` right after the `style` attribute or from an XML comment right after the `style` attribute
  - Lots of attribute info comes from various sources:
    - Gather list of all attributes
      - Get `attribute` tags in the `element` tag
      - Look in `ref` tags in `element` and check if `define` has first child `attribute` or `optional` then `attribute` (`category`, `closed`, `link-href`, `link-title`, `link-id`)
      - Do not consider the `style` attribute as a normal attribute as it is the marker name rather than a USFM attribute
      - Do not consider the `closed` attribute as a normal attribute as it is a special attribute that is never output to USFM
      - Do not consider `colspan` attribute on `cell` as a normal attribute as it is incorporated into the marker name and is not a USFM attribute
    - There are many kinds of special attribute types in USFM representation. One attribute cannot be multiple types of special attribute. Check if an attribute is a special type in this listed order:
      - Attributes should not be considered for being a special attribute type in any of the following circumstances:
        - the `attribute` tag has are multiple `usfm:match` tags
        - name is `style` since that attribute is always the marker name in USFM
        - the attribute is listed in `markerType.skipOutputAttributeToUsfm` because these special attribute types are related to USFM output
        - the attribute is listed in `markerType.skipOutputMarkerToUsfmIfAttributeIsPresent` because these special attribute types are related to USFM output
        - The `attribute` has any `usfm:match` with `beforeout` containing `|<attribute-name>=`. This is here to prevent `id` on `periph` from being default because it is an unusual USFM marker that doesn't have a default even though it has an attribute
      - (`marker.attributeMarkerAttributeName`) attribute markers - e.g. `altnumber`/`ca`, `pubnumber`/`cp`, `altnumber`/`va`, `pubnumber`/`vp`, `category`/`cat`
        - One `usfm:match` or `usfm:tag` or `usfm:ptag` with `beforeout` `\\__`
          - [Special case] `version` on `usx` is not an attribute marker (this special case may be unnecessary if the generation script is improved to handle markers that are not directly represented in USFM)
        - (`markers` keys; `markersRegExp` keys) get marker name from `beforeout`
        - (`marker.hasStructuralSpaceAfterCloseAttributeMarker`)`afterout` will have a space after the marker name like `\\__ ` if there should be a space in the canonical output USFM
        - (`marker.type`) `para` if `usfm:ptag` or `beforeout` has `\n`; `char` otherwise
        - (`marker.isAttributeMarkerFor`/`marker.attributeMarkers`) record the connection between the marker this attribute marker is listed on and this attribute marker
      - (`marker.textContentAttribute`) text content attribute - e.g. `periph`'s `alt`
        - One `usfm:match` with `match="TEXTNOTATTRIB"` or `match="TEXTNWS"`
          - [Special case] `usx` marker `version` is text content (it has `match="TEXTNWS"` in one of two occurrences; probably should be on both. Probably needs some kind of special marking indicating `usx` marker is replaced by `usfm` marker)
      - (`marker.leadingAttributes`) Leading attributes - e.g. `v`'s `number`
        - One `usfm:match` is present
          - `match` must not be `TEXTNOTATTRIB` or `TEXTNOTATTRIBOPT`
          - `beforeout` must not contain `\\__ `
      - (`marker.defaultAttribute`) If the marker has a default attribute, it may come from one of two places
        - The default attribute will be the value of the `usfm:propval` attribute on the `value` tag in the `style` attribute or in the enumeration.
        - If there is no `usfm:propval` attribute on the `value` tag in the `style` attribute or there is no `style` attribute, the default attribute for a marker will be the first non-optional `attribute` `name` listed in the element other than the attributes to skip or the first optional non-skipped `attribute` `name` if there are no non-optional non-skipped `attribute`s. There is only a default attribute if there are zero or one non-optional non-skipped `attribute`s.
          - Attributes should be skipped when determining which attribute is the default attribute via normal rules of these instructions for attributes (meaning they are not in the list of attributes that should not be considered and are not other special attribute types like leading attributes)
          - [Special case] In less than 3.1, do not consider `link-href`, `link-title`, or `link-id` for default attribute because these attributes are common [linking attributes](https://ubsicap.github.io/usfm/linking/index.html) that can be on many markers but are only default on `jmp` and `xt` (but they are not marked differently on those, so this must be hard-coded)
- Marker type information:
  - (`markerType.hasStyleAttribute`) note when the marker shouldn't have a `style` attribute
    - If the element has no `style` attribute, the marker shouldn't either.
      - Do not consider the marker type to have no `style` attribute if all `ref`s pointing to it have `usfm:ignore="true"`, meaning it is just listing attributes that indicate the whole marker should not be output to USFM
  - (`markerType.skipOutputAttributeToUsfm`) Do not output an attribute to USFM if:
    - `attribute` has `usfm:ignore="true"` (`attribute` - chapter and verse `sid`, `closed`)
    - `attribute` `name` has `ns="http://www.w3.org/2001/XMLSchema-instance"` on it or name starts with `xsi:` (these attributes are not related to Scripture data and should not be exported to USFM)
    - the attribute is `vid` on `para` or `table` (probably should have `usfm:ignore` set)
    - the attribute is `sid` in `chapter` (probably should have `usfm:ignore` set)
    - [Special case] the attribute is `align` or `colspan` attributes in `cell` marker type
      - `align` (probably should have `usfm:ignore` set because it is already embedded in the style)
      - `colspan` probably needs some kind of special something set because it gets embedded in the style for USFM but is not present in the style already in USX/USJ
  - (`markerType.skipOutputMarkerToUsfmIfAttributeIsPresent`) Ignore the opening and closing markers when translating to usfm (but keep the contents of the marker) if `attribute`s listed in the `markerType` are present if any of the following are true:
    - If all `ref`s pointing to the `define` have `usfm:ignore="true"` (chapter and verse `eid`)
    - If any `usfm:match` in the attribute has `noout="true"` attribute on it (ref `gen`)
  - (`markerType.hasNewlineBefore`) marker type should have newlines before the marker if
    - In `style` attribute element (or, if there is no `style` element, in the `element` element), one `usfm:ptag` or `usfm:tag` or `usfm:match` direct child with `beforeout` with `\n` in it (`verse` - `\n` is optional, whereas it does not seem to be optional in the others. Does this matter for us? I don't think so; I think it all normalizes out to being just whitespace).
      - [Special case] `cell` has `usfm:ptag` but should not have a newline before it. TJ thinks is a bug in `usx.rng`.
      - [Special case] `periph` doesn't have `\n` in its `usfm:match` `beforeout`, but it should have a newline before it. TJ thinks is a bug in `usx.rng`.
      - [Special case] `usx` doesn't have `\n` in its `usfm:match` `beforeout`, but it should have a newline before it. TJ thinks this is a bug in `usx.rng`.
  - (`markerType.hasClosingMarker`) the marker type has a normal closing marker if
    - One `usfm:endtag` is present somewhere in the element
      - If there are two that share the same attributes other than `matchref` and `before` being the same other than a `+` in one, can consider just the first one. This is for some `char` markers that have both `\nd` and `\+nd` listed
      - `usfm:endtag` is outside the `element` for `milestone` because its `element` has `<empty/>` in it
      - `ref` should have closing marker. `usfm:endtag` is outside the element for some reason.
    - (`markerType.isClosingMarkerEmpty`) Closing marker is empty if `matchref="&#x27;&#x27;"` (which basically means empty - there is very intentionally nothing to match)
      - Note: `ref`'s `usfm:endtag` has `matchref=""`, and it should have a closing marker
      - Note: `category` has `matchref=""` and `matchout` is not empty/not provided (`category`). If we end up handling `category` more precisely, this might need to be considered.

<!--
    - Notes on skipped attributes for determining rules for which to skip when determining default attribute (these attributes are now all covered by the above listed rules for when to skip attributes, but there is some additional information here that may be useful for later markers map additions. Note some of this may not be reflective of current information available in the markers map):
      - `version` and `noNamespaceSchemaLocation` on `usx` marker type
        - `version` is the marker's text content in USFM (has `usfm:match` but not `match="TEXTNOTATTRIB"`. Special case). If this were not considered a `para`, it would be fine to consider it a leading attribute. But this is a `para`, so we will just confuse things if we consider it a leading attribute.
        - `noNamespaceSchemaLocation` is part of XML spec and is not part of USFM (has `ns` populated on its `name` - is that a good indicator?)
      - `code` on `book` marker type
        - `code` is a leading attribute in USFM (has `usfm:match`)
      - `alt` and `id` on `periph` marker type
        - `alt` is the marker's text content in USFM (has `usfm:match match="TEXTNOTATTRIB"`)
        - `id` seems to be an exception. There does not appear to be any particular reason why `id` should not be the default attribute, but it is not. (has `usfm:match` with `beforeout="&#x27;|id=&quot;&#x27;"` because it is hard-coded to be in the USFM and not default)
      - `style` on any marker type (do all have `usfm:tag`/`usfm:ptag`? Anything else with `usfm:tag` or `ptag`? `esbe`(has text content), `cat` (attribute), `ref`(doesn't have text content))
        - `sidebar` has `usfm:ptag` direct child with non-matching text content `esbe` which should be a new marker
        - `ref` has `usfm:tag` direct child with no text content, so it shouldn't be a new marker
        - `periph` and `optbreak` have `usfm:match` direct children, but these do not indicate a new marker. Just part of the marker itself
      - all of `fig`'s "FigureTwo" deprecated syntax attributes have `usfm:match beforeout="|" match="TEXTNOTATTRIBOPT"`, but none of them are leading attributes or text content.
      - `vid` on `para` and `table` marker types
        - `vid` is derived metadata in USX/USJ and is not present in USFM (no obvious indication in `usx.rng`)
      - `align` and `colspan` on `cell` marker type
        - These are used in determining which table marker to use in USFM, but they are not paired well enough to the specific markers to do anything with at this time
      - `number`, `altnumber`, `pubnumber`, `sid`, and `eid` on `chapter` marker type
        - `number` is a leading attribute in USFM (has `usfm:match`)
        - `altnumber` is transformed into the text content of a new `ca` marker in USFM (has `usfm:match beforeout="&#x27;\\ca &#x27;"`)
        - `pubnumber` is transformed into the text content of a new `cp` marker in USFM (has `usfm:match beforeout="&#x27;\n\\cp &#x27;"`)
        - `sid` is derived metadata in USX/USJ and is not present in USFM (no obvious indication in `usx.rng`)
        - `eid` is derived metadata in USX/USJ and is not present in USFM. In fact, the `chapter` markers with `eid` is not present in USFM at all (`usfm:ignore="true"` is on the `ref` to `ChapterEnd` in `usx.rng`)
      - `number`, `altnumber`, `pubnumber`, `sid`, and `eid` on `verse` marker type
        - `number` is a leading attribute in USFM (has `usfm:match`)
        - `altnumber` is transformed into the text content of a new `va` marker in USFM (has `usfm:tag` with `dump="true" beforeout="&#x27;\\va &#x27;"`)
        - `pubnumber` is transformed into the text content of a new `vp` marker in USFM (has `usfm:tag` with `dump="true" beforeout="&#x27;\\vp &#x27;"`)
        - `sid` is derived metadata in USX/USJ and is not present in USFM (`usfm:ignore="true"` in `usx.rng`)
        - `eid` is derived metadata in USX/USJ and is not present in USFM. In fact, the `chapter` markers with `eid` is not present in USFM at all (`usfm:ignore="true"` is on the `ref` to `VerseEnd` in `usx.rng`)
      - `caller` and `category` on `note` marker type
        - `caller` is a leading attribute in USFM (has `usfm:match`)
        - `category` is transformed into the text content of a new `cat` marker in USFM (has `usfm:tag` with `dump="true" beforeout="&#x27;\\cat &#x27;"`)
          - `category` is in a `ref`
      - `category` on `sidebar` marker type
    - Exception: For `ms` marker types, `who` takes priority over other attributes if it is present.
    - Exception: `ref` for some reason has `usfm:match` on both its attributes, `loc` and `gen`, though they are both normal attributes. `gen` has no representation in USFM, though, as it indicates the marker should be removed when transforming back to USFM. `loc` has `matchout="&#x27;|&#x27;"`, so I guess it could be differentiated from `periph`'s `id` by checking for more text after the |. `gen` has `usfm:match noout="true"`.
-->

### Future improvements

Following are some improvements that could potentially be made to further strengthen this markers map generation:

- Do some work to encode that the `usx`, `usfm`, and `USJ` markers are different in each standard
- Should all the special attribute stuff be on `markerType` instead? Some risk in that `cat` is a marker attribute on all `note` marker types, but maybe that's coincidence and it may not forever and always be on all `note` marker types
- Explain how the terms I am using from XML sorta map to the USFM concepts but aren't exact one-to-one equals
- [markerType] note when the marker shouldn't have a `style` attribute
  - Improve accuracy: if the `element` has no `style` attribute and has direct child `usfm:tag` (`ref`), `usfm:ptag` (none - `sidebar` is closest), or `usfm:match` (`periph` and `optbreak`), no `style` attribute. If doesn't have one of these direct children (`table`, `usx`), the marker shouldn't be output to USFM at all. Or at least it indicates a very special case. Maybe not handling this yet is why `usx` considers `usfm` to be a marker attribute in the `usx.rng` but we don't. And `table`
  - `usx` doesn't have `usfm:tag` or `usfm:ptag` and its attribute has `beforeout` with `\\__`. Could use those two indicators to determine it should be replaced with `usfm` in output. But then this still doesn't cover moving `usfm` under `id`
- [markerType] Figure out how to determine when to close these long-running markers with their own content hierarchies - `usx`, `table`, `periph`, `esb`, others? Actually probably need a general way to represent how any marker closes, not just these specific ones close
- Do we need to keep track of whether a nested marker that closes has `+` on its markers?
- `cl` and `esbe` both specify `afterout="&#x27;\n&#x27;"` meaning a newline after them. But it seems to get reduced with newlines that come before the stuff after, so I dunno if we really need this. Maybe test P9 putting stuff after these markers and see what happens
  - `book` marker type also has a `usfm:match` in it with `matchout="&#x27;\n&#x27;"`. Thinking this indicates it is a block-level marker, but it's weird because this may be the only one like this. All other block-level markers have `usfm:ptag`. But `id` is always the first line of the file. How should we track this?
  - Actually, it seems `hasNewlineBefore` doesn't line up with block-level marker types for `periph` or `verse` (optional newline) either. Maybe block-level should be its own property on marker types.
    - `periph` is not quite a block-level marker type, actually; more like a multi-block type. Need to define some rules around when these can end. `periph`, `table`, `usx`, `esb` (has its own closing marker). Can provide attributes in USFM with inline syntax, not block-level syntax.
- If needed, can tell if marker type doesn't have text content via `<empty/>`
  - Probably doesn't matter for our needs because, if a marker is empty, it won't have `contents`. You can tell if there should be a closing marker (like milestones) from other things.

### Special cases

The `usx.rng` file does not contain every single piece of information necessary for performing the supported operations with the markers map (like transforming USJ to USFM). Following are some special additions and exceptions to the rules for determining the markers map from the `usx.rng` file that are manually encoded into the markers map to ensure its completeness. Note that not all exceptions are necessarily listed here; you can find exceptions by looking for `special case:` in `src/markers-map.util.ts`.

- All rules starting with [Special case] in the sections above
- There are some markers that need very special handling that is not represented perfectly in `usx.rng`. In `markers.json`, the special handling is explained in `parseUsfmInstructions` and `outputToUsfmInstructions`:
  - [`usfm`](https://docs.usfm.bible/usfm/3.1/doc/usfm.html) with marker type `para` and no default attribute. This marker is present in USFM but most of the time is translated into the `usx` marker in USX and the `USJ` marker in USJ
    - Note that `usfm` is a special `para` in that its text content is considered to be `version`, which gets translated to `usx` and `USJ` as an attribute.
  - [`USJ`](https://docs.usfm.bible/usfm/3.1/doc/usfm.html) with marker type `USJ` and no default attribute. This marker is present in USJ but is translated into the `usx` marker in `USX` and the `usfm` marker in USFM.
  - [`cell`](https://docs.usfm.bible/usfm/3.1/char/tables/tc.html)-type markers encode the number of columns they span differently between USFM and USX/USJ

Note: `fig` has an attribute that changes names: in USFM, it is `src`; in USX and USJ, it is `file`.

### Examples

Following is a snippet from the schema that is an example of one marker name and marker type:

```xml
  <define name="PeripheralBookIdentification">
    <element>
      <name ns="">book</name>
      <attribute>
        <usfm:tag before="/﻿?${anyws}*\\/" beforeout="&#x27;\\&#x27;" usfm:seq="true"/>
        <name ns="">style</name>
        <value>id</value>
      </attribute>
      <attribute>
        <usfm:match/>
        <name ns="">code</name>
        <ref name="PeripheralBookIdentification.book.code.enum"/>
      </attribute>
      <group usfm:seq="true">
        <optional>
          <group>
            <usfm:match before="/${hs}*/" beforeout="&#x27; &#x27;" match="/[^\\\n\r]*/"/>
            <text/>
          </group>
        </optional>
        <usfm:match match="NL" matchout="&#x27;\n&#x27;" dump="true"/>
      </group>
    </element>
  </define>
```

Generating the marker map from only this snippet would result in the following:

```json
{
  "markers": {
    "id": {
      "type": "book"
    }
  }
}
```

Following is a snippet from the schema that is an example of many marker names in a `choice` that share a marker type:

```xml
  <define name="Footnote">
    <element name="note">
      <attribute name="style">
        <choice>
          <value>f</value>
          <value>fe</value>
          <value>ef</value>
        </choice>
      </attribute>
      <attribute name="caller"/>
      <optional>
        <attribute name="category"/>
      </optional>
      <oneOrMore>
        <choice>
          <ref name="FootnoteChar"/>
          <text/>
        </choice>
      </oneOrMore>
    </element>
  </define>
```

Generating the marker map from only this snippet would result in the following:

```json
{
  "markers": {
    "f": {
      "type": "note"
    },
    "fe": {
      "type": "note"
    },
    "ef": {
      "type": "note"
    }
  }
}
```

Following is a snippet from the schema that is an example of many marker names in a `choice` in a `ref` that share a marker type:

```xml
  <define name="BookTitles">
    <element>
      <name ns="">para</name>
      <attribute>
        <usfm:ptag/>
        <name ns="">style</name>
        <ref name="Title.para.style.enum"/>
      </attribute>
      <zeroOrMore>
        <choice>
          <text>
            <usfm:text/>
          </text>
          <ref name="Footnote"/>
          <ref name="CrossReference"/>
          <ref name="Char"/>
          <ref name="Break"/>
        </choice>
      </zeroOrMore>
    </element>
  </define>
  <define name="Title.para.style.enum">
    <choice>
      <value>mt1</value>
      <a:documentation>The main title of the book (if multiple levels)</a:documentation>
      <value>mt2</value>
      <a:documentation>A secondary title usually occurring before the main title</a:documentation>
      <value>mt3</value>
      <a:documentation>A tertiary title occurring after the main title</a:documentation>
      <value>mt4</value>
      <value>mt</value>
      <a:documentation>The main title of the book (if single level)</a:documentation>
      <value>rem</value>
      <a:documentation>Remark</a:documentation>
    </choice>
  </define>
```

Generating the marker map from only this snippet would result in the following:

```json
{
  "markers": {
    "mt1": {
      "type": "para"
    },
    "mt2": {
      "type": "para"
    },
    "mt3": {
      "type": "para"
    },
    "mt4": {
      "type": "para"
    },
    "mt": {
      "type": "para"
    },
    "rem": {
      "type": "para"
    }
  }
}
```

Following is a partial snippet from the schema that is an example of many marker names, some with default attributes, that share a marker type:

```xml
  <define name="Milestone">
    <group>
      <element>
        <name ns="">ms</name>
        <attribute>
          <usfm:tag after="Hs" afterout=""/>
          <name ns="">style</name>
          <ref name="Milestone.style.enum"/>
        </attribute>
        <optional>
          <ref name="Attributes"/>
        </optional>
        <empty/>
      </element>
      <usfm:endtag matchref="&#x27;&#x27;"/>
    </group>
  </define>
  <define name="Milestone.style.enum">
    <choice>
      <value usfm:propval="sid" usfm:propattribs="sid?" usfm:propended="ts-e">ts-s</value>
      <value usfm:propval="eid" usfm:propattribs="eid?" usfm:propends="ts-s">ts-e</value>
      <value>ts</value>
      <value usfm:propval="sid" usfm:propattribs="sid?" usfm:propended="t-e">t-s</value>
      <value usfm:propval="eid" usfm:propattribs="eid?" usfm:propends="t-s">t-e</value>
      <value usfm:propval="who" usfm:propattribs="who? sid?" usfm:propended="qt1-e">qt1-s</value>
      <value usfm:propval="eid" usfm:propattribs="eid?" usfm:propends="qt1-s">qt1-e</value>
      <value usfm:propval="who" usfm:propattribs="who? sid?" usfm:propended="qt2-e">qt2-s</value>
      <value usfm:propval="eid" usfm:propattribs="eid?" usfm:propends="qt2-s">qt2-e</value>
    </choice>
  </define>
```

Generating the marker map from only this snippet would result in the following:

```json
{
  "markers": {
    "ts-s": {
      "type": "ms",
      "defaultAttribute": "sid"
    },
    "ts-e": {
      "type": "ms",
      "defaultAttribute": "eid"
    },
    "ts": {
      "type": "ms"
    },
    "t-s": {
      "type": "ms",
      "defaultAttribute": "sid"
    },
    "t-e": {
      "type": "ms",
      "defaultAttribute": "eid"
    },
    "qt1-s": {
      "type": "ms",
      "defaultAttribute": "who"
    },
    "qt1-e": {
      "type": "ms",
      "defaultAttribute": "eid"
    },
    "qt2-s": {
      "type": "ms",
      "defaultAttribute": "who"
    },
    "qt2-e": {
      "type": "ms",
      "defaultAttribute": "eid"
    }
  }
}
```

Following is a partial snippet from the schema that is an example of a marker that has the same type and name with no style attribute and with a default attribute:

```xml
  <define name="Reference">
    <element>
      <usfm:tag match="&#x27;ref&#x27;" dump="true"/>
      <name ns="">ref</name>
      <optional>
        <text>
          <usfm:text match="TEXTNOTATTRIB" after="ATTRIBTEXTEND"/>
        </text>
      </optional>
      <optional>
        <attribute>
          <usfm:match match="PIPE" matchout="&#x27;|&#x27;" dump="true"/>
          <usfm:match match="TEXTNOTATTRIB"/>
          <name ns="">loc</name>
          <data type="string">
            <usfm:pattern name="VERSE"/>
            <param name="pattern">[A-Z1-4]{3}(-[A-Z1-4]{3})? ?[a-z0-9\-:]*</param>
          </data>
        </attribute>
      </optional>
      <optional>
        <attribute>
          <usfm:match match="TEXTNOTATTRIB" noout="true"/>
          <name ns="">gen</name>
          <choice>
            <value>true</value>
            <value>false</value>
          </choice>
        </attribute>
      </optional>
    </element>
    <usfm:endtag match="&#x27;ref&#x27;" matchref=""/>
  </define>
```

Generating the marker map from only this snippet would result in the following:

```json
{
  "markers": {
    "ref": {
      "type": "ref",
      "defaultAttribute": "loc"
    }
  }
}
```

Following is a snippet from the schema that is an example of a `markersRegExp` entry in which the marker name is matched with RegExp:

```xml
  <define name="TableContent">
    <element>
      <name ns="">cell</name>
      <attribute>
        <usfm:ptag/>
        <name ns="">style</name>
        <data type="string">
          <param name="pattern">t[hc][rc]?\d+(-\d+)?</param>
        </data>
      </attribute>
      <attribute>
        <name ns="">align</name>
        <ref name="cell.align.enum"/>
      </attribute>
      <optional>
        <attribute>
          <name ns="">colspan</name>
          <data type="integer"/>
        </attribute>
      </optional>
      <zeroOrMore>
        <choice>
          <text>
            <usfm:text/>
          </text>
          <ref name="CharEmbed"/>
          <ref name="Figure"/>
          <ref name="Milestone"/>
          <ref name="Verse"/>
          <ref name="Footnote"/>
          <ref name="CrossReference"/>
          <ref name="Break"/>
        </choice>
      </zeroOrMore>
    </element>
  </define>
```

Generating the marker map from only this snippet would result in the following:

```json
{
  "markersRegExp": {
    "t[hc][rc]?\d+(-\d+)?": {
      "type": "cell"
    }
  }
}
```

Here is an example of some USX data. The tag names are the marker types, and the `style` attributes are the marker names:

```xml
<usx version="3.0">
  <book code="EXO" style="id">World English Bible (WEB)</book>
  <para style="ide">UTF-8</para>
  <para style="h">Exodus</para>
  <para style="toc1">The Second Book of Mosis, Commonly Called Exodus</para>
  <para style="toc2">Exodus</para>
  <para style="toc3">Exodus</para>
  <para style="mt2">The Second Book of Moses,</para>
  <para style="mt3">Commonly Called</para>
  <para style="mt1">Exodus</para>
  <chapter number="1" style="c" sid="EXO 1" />
  <para style="p">
    <verse number="1" style="v" sid="EXO 1:1" />Now these are the names of the sons of Israel, who came into Egypt (every man and his household came with Jacob): <verse eid="EXO 1:1" /><verse number="2" style="v" sid="EXO 1:2" />Reuben, Simeon, Levi, and Judah, <verse eid="EXO 1:2" /><verse number="3" style="v" sid="EXO 1:3" />Issachar, Zebulun, and Benjamin, <verse eid="EXO 1:3" /><verse number="4" style="v" sid="EXO 1:4" />Dan and Naphtali, Gad and Asher. <verse eid="EXO 1:4" /><verse number="5" style="v" sid="EXO 1:5" />All the souls who came out of Jacob’s body were seventy souls, and Joseph was in Egypt already. <verse eid="EXO 1:5" /><verse number="6" style="v" sid="EXO 1:6" />Joseph died, as did all his brothers, and all that generation. <verse eid="EXO 1:6" /><verse number="7" style="v" sid="EXO 1:7" />The children of Israel were fruitful, and increased abundantly,</para>
  <para style="zTJ" vid="EXO 1:7">and multiplied, and grew exceedingly mighty; and the land was filled with them.<verse eid="EXO 1:7" /></para>
  <chapter eid="EXO 1" />
</usx>
```

</details>
