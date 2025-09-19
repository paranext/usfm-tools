# usfm-tools
Scripts and utilities for transforming and preparing US* schemas for use in Platform.Bible and Paratext

## Setup

To get started with this repo, first clone the repo:

```
git clone https://github.com/paranext/usfm-tools.git
```

Then install dependencies:

```
npm i
```

## Generate Markers Map

Generate the markers map by placing the USX RelaxNG Schema file `usx.rng` (download the file on a release branch - [`usx.rng` < 3.1](https://github.com/ubsicap/usx/blob/master/schema/usx.rng) or [`usx.rng` >= 3.1](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng)) in the root of this repo and running `npm run generate-markers-map -- --schema usx.rng --version <schema-version> --commit <commit-hash>`. Note that the commit hash is the commit hash for the repo where you got `usx.rng`, *not* the commit hash of this repo.

This script reads the USX RelaxNG Schema file [`usx.rng`](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng) and generates a JSON file `dist/markers.json` and a TypeScript file `dist/markers-map.model.ts` that contain various information for each USFM marker name. `markers.json` will contain an object with:
- information about the generated file (`version`, `commit`)
- a `markers` property whose value is a map object
  - keys are the marker names
  - values are objects containing information about the marker such as the marker type and the marker's default attribute (where applicable)
- a `markersRegExp` property whose value is the same thing as `markers` but for markers whose names match the keys using RegExp
- a `markerTypes` property whose value is a map object
  - keys are the marker types
  - values are objects that are currently empty but may be filled with information about the marker types in the future

This object is also exported from `dist/markers-map.model.ts` as `USFM_MARKERS_MAP`. `dist/markers-map.model.ts` also contains TypeScript types relevant to this object.

Following is a simplified example of what you might see in a `markers.json` file:

```json
{
  "version": "5.2-test.123",
  "commit": "abc123",
  "markers": {
    "v": {
        "type": "verse"
    },
    "c": {
        "type": "chapter"
    },
    "p": {
        "type": "para"
    },
    "f": {
        "type": "note"
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
    "verse": {},
    "chapter": {},
    "para": {},
    "note": {},
    "ms": {},
    "cell": {}
  }
}
```

<details>
    <summary>Expand to read about how the data in `usx.rng` is transformed into `markers.json`</summary>

The marker names and information about those markers are derived from the `usx.rng` file. This schema file contains information about each valid USFM marker in the various `element` definitions (definition contents other than `element` likely have useful information but do not specifically contain markers):
- The element's `name` is the marker type
- The marker name comes from one of a number of places:
    - The `style` attribute may contain the single marker name for that marker type
    - The `style` attribute may contain a `choice` of all the marker names associated with that marker type
    - The `style` attribute may contain a `ref` pointing to a `choice` of all the marker names associated with that marker type
    - If there is not a `style` attribute, the element's `name` is the marker type and the marker name
- If the marker has a default attribute, it may come from one of two places
    - The default attribute will be the value of the `usfm:propval` attribute on the `value` tag in the `style` attribute or in the enumeration.
    - If there is no `usfm:propval` attribute on the `value` tag in the `style` attribute or there is no `style` attribute, the default attribute for a marker will be the first non-optional `attribute` `name` listed in the element other than the list below of attributes to skip or the first optional non-skipped `attribute` `name` if there are no non-optional non-skipped `attribute`s. There is only a default attribute if there are zero or one non-optional non-skipped `attribute`s.
        - The following attributes should be skipped when determining which attribute is the default attribute:
            - `version` and `noNamespaceSchemaLocation` on `usx` marker type
              - `version` is the marker's text content in USFM (has `usfm:match` but not `match="TEXTNOTATTRIB"`. Special case). If this were not considered a `para`, it would be fine to consider it a leading attribute. But this is a `para`, so we will just confuse things if we consider it a leading attribute.
              - `noNamespaceSchemaLocation` is part of XML spec and is not part of USFM (has `ns` populated on its `name` - is that a good indicator?)
            - `code` on `book` marker type
              - `code` is a leading attribute in USFM (has `usfm:match`)
            - `alt` and `id` on `periph` marker type
              - `alt` is the marker's text content in USFM (has `usfm:match match="TEXTNOTATTRIB"`)
              - `id` seems to be an exception. There does not appear to be any particular reason why `id` should not be the default attribute, but it is not. (has `usfm:match` with `beforeout="&#x27;|id=&quot;&#x27;"` because it is hard-coded to be in the USFM and not default)
            - `style` on any marker type (TODO: do all have `usfm:tag`/`usfm:ptag`? Anything else with `usfm:tag` or `ptag`? `esbe`(has text content), `cat` (attribute), `ref`(doesn't have text content))
              - `sidebar` has `usfm:ptag` direct child with non-matching text content `esbe` which should be a new marker
              - `ref` has `usfm:tag` direct child with no text content, so it shouldn't be a new marker
              - `periph` and `optbreak` have `usfm:match` direct children, but these do not indicate a new marker. Just part of the marker itself
            - TODO: all of `fig`'s "FigureTwo" deprecated syntax attributes have `usfm:match beforeout="|" match="TEXTNOTATTRIBOPT"`, but none of them are leading attributes or text content.
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
                - TODO: `category` is in a `ref` and is not actually parsed right now
            - `category` on `sidebar` marker type
        - Exception: For `ms` marker types, `who` takes priority over other attributes if it is present.
        - Exception: `ref` for some reason has `usfm:match` on both its attributes, `loc` and `gen`, though they are both normal attributes. `gen` has no representation in USFM, though, as it indicates the marker should be removed when transforming back to USFM. `loc` has `matchout="&#x27;|&#x27;"`, so I guess it could be differentiated from `periph`'s `id` by checking for more text after the |. `gen` has `usfm:match noout="true"`.

TODO: Improve wording/list exception cases we don't deal with right now
- `closed` attribute is just gonna be an exception for now: you have to know not to put the closing tag if `closed="false"`
  - also not listing `closed` tag in `skipOutputAttributeToUsfm` because it is always skipped you do something special with it anyway
- Derived metadata is also gonna be an exception; we aren't going to factor those in right now.
  - `vid` on `para` and `table`
  - `sid` and `eid` on `chapter` and `verse`
  - `align` on `cell`
- tables are not supported yet
  - `table` marker goes around all the `tr`s in USX and USJ
  - `row` -> `table:row` in USJ
  - `cell` -> `table:cell` in USJ
  - `colspan` on `cell` gets put in the marker name in USFM
- `optbreak` is pretty exceptional or at least will be until otherwise

TODO: adjust README based on new changes
- Skip the definition if all `ref`s pointing to it are pointing to it via `usfm:alt` attribute instead of `name` (`FigureTwo`)
- [markerType] note when the marker shouldn't have a `style` attribute
  - If the element has no `style` attribute, the marker shouldn't either.
    - Do not consider the marker type to have no `style` attribute if all `ref`s pointing to it have `usfm:ignore="true"`, meaning it is just listing attributes that indicate the whole marker should not be output to USFM
- Need to look in `ref` tags in `element` and check if `define` has first child `attribute` or `optional` then `attribute` (`category`, `closed`)
- [marker] ignore when translating to USFM
  - If all `ref`s pointing to it have `usfm:ignore="true"`, ignore the entire marker when translating to usfm if `attribute`s listed in the `markerType` are present (chapter and verse `eid`)
  - If `attribute` `name` has `ns="<not-empty>"` on it (these attributes are not related to Scripture data and should not be exported to USFM)
  - If its `attribute` has `usfm:ignore="true"` or any `usfm:match` in the attribute has `noout="true"` attribute on it (`attribute` - chapter and verse `sid`, `closed`)
  - If it is `vid` on `para` or `table` (probably should have `usfm:ignore` set)
  - If it's `sid` in `chapter` (probably should have `usfm:ignore` set)
  - `align` and `colspan` attributes in `cell` marker type
    - `align` (probably should have `usfm:ignore` set because it is already embedded in the style)
    - `colspan` probably needs some kind of special something set because it gets embedded in the style for USFM but is not present in the style already in USX/USJ
- [marker] attributes
  - Warn the attribute will not be considered for special attribute types if there are multiple `usfm:match` tags
  - Do not consider for any special attribute things if name is `style` since that attribute is always the marker name in USFM
  - Do not consider for default attribute if any `usfm:match` with `beforeout` containing `|<attribute-name>=`. This is here to prevent `id` on `periph` from being default even though it reasonably should be
- [marker] attribute markers - `ca`, `cp`, `va`, `vp`, `cat`
  - One `usfm:match` or `usfm:tag` or `usfm:ptag` with  `beforeout` `\\__`
    - Special case: `version` on `usx` is not an attribute marker (probably needs some kind of special marking indicating `usx` marker is replaced by `usfm` marker, then `version` could be adjusted to be text content attribute without a special case)
  - get marker name from `beforeout`
  - `para` if `usfm:ptag` or `beforeout` has `\n`; `char` otherwise
  - `isAttributeMarker` on the attribute-created marker
  - `attributeMarkers` list on the parent marker
- [markerType] programmatically determine if marker types should have newlines before the marker
  - In `style` attribute element (or, if there is no `style` element, in the `element` element), one `usfm:ptag` or `usfm:tag` or `usfm:match` direct child with `beforeout` with `\n` in it (`verse` - `\n` is optional, whereas it does not seem to be optional in the others. Does this matter for us? I don't think so; I think it all normalizes out to being just whitespace).
    - `cell` has `usfm:ptag` which I think is a bug.
    - `periph` doesn't have `\n` in its `usfm:match` `beforeout`, which I think is a bug.
- [marker] additional very simple markers that go with other markers
  - Check for marker type element direct children `usfm:ptag` or `usfm:tag` with text content and create a simple marker (no attributes or whatnot from the other markers of this marker type) whose name is the text content of the tag. Like `esbe` in `sidebar` marker type

TODO: incorporate changes
- Figure out a way to get this to where you can work on the rest of the code
- Transform 3.1 to 3.0 somehow?
- [marker] text content attributes
  - One `usfm:match` with `match="TEXTNOTATTRIB"`
    - Special case: `usx` marker `version` is text content. Do some work to encode that the markers are different in each standard
- [marker] Leading attributes
  - One `usfm:match` is present
    - `match` must not be `TEXTNOTATTRIB` or `TEXTNOTATTRIBOPT`
    - `beforeout` must not contain `\\__ `
- [marker] comments
- [markerType] programmatically determine if marker types need closing tag
 - `usfm:endtag` is present in the element
 - `usfm:endtag` is outside the `element` for `milestone` because its `element` has `<empty/>` in it
 - Closing tag is empty if `matchref="" or "&#x27;&#x27;"` and `matchout` is not empty/not provided (`category`)
  - [marker] closing tag should not go in the USFM if `noout="true"`
- Explain how the terms I am using from XML sorta map to the USFM concepts but aren't exact one-to-one equals
- [markerType] note when the marker shouldn't have a `style` attribute
  - Improve accuracy: if the `element` has no `style` attribute and has direct child `usfm:tag` (`ref`), `usfm:ptag` (none - `sidebar` is closest), or `usfm:match` (`periph` and `optbreak`), no `style` attribute. If doesn't have one of these direct children (`table`, `usx`), the marker shouldn't be output to USFM at all. Or at least it indicates a very special case. Maybe not handling this yet is why `usx` considers `usfm` to be a leading attribute in the `usx.rng` but we don't.
- Extra work later?
  - Do we need to keep track of whether a nested marker that closes has `+` on its markers? Probably, but maybe the plus is on the style in USX
    - Paratext 9.4 fails to nest markers without the `+`. It doesn't put anything particular if the `+` is present. I guess that means we might just need to track if `+` is present for 
  - `cl` and `esbe` both specify `afterout="&#x27;\n&#x27;"` meaning a newline after them. But it seems to get reduced with newlines that come before the stuff after, so I dunno if we really need this. Maybe test P9 putting stuff after these markers and see what happens
  - If needed, can tell if marker type doesn't have text content via `<empty/>`
    - Probably doesn't matter for our needs because, if a marker is empty, it won't have `contents`. You can tell if there should be a closing marker (like milestones) from other things.

There are also some markers that are not necessarily listed in `usx.rng` but need to be present in `markers.json`:
- [`cat`](https://docs.usfm.bible/usfm/3.1/cat/cat.html) with marker type `char` and no default attribute. This marker is present in USFM but is an attribute in USX and USJ
- [`ca`](https://docs.usfm.bible/usfm/3.1/cv/ca.html) with marker type `char` and no default attribute. This marker is present in USFM but is an attribute in USX and USJ
- [`cp`](https://docs.usfm.bible/usfm/3.1/cv/cp.html) with marker type `para` and no default attribute. This marker is present in USFM but is an attribute in USX and USJ
- [`va`](https://docs.usfm.bible/usfm/3.1/cv/va.html) with marker type `char` and no default attribute. This marker is present in USFM but is an attribute in USX and USJ
- [`vp`](https://docs.usfm.bible/usfm/3.1/cv/vp.html) with marker type `char` and no default attribute. This marker is present in USFM but is an attribute in USX and USJ
- [`usfm`](https://docs.usfm.bible/usfm/3.1/doc/usfm.html) with marker type `para` and no default attribute. This marker is present in USFM but most of the time is translated into the `usx` marker in USX and the `USJ` marker in USJ
  - Note that `usfm` is a special `para` in that its text content is considered to be `version`, which gets translated to `usx` and `USJ` as an attribute.
- [`USJ`](https://docs.usfm.bible/usfm/3.1/doc/usfm.html) with marker type `USJ` and no default attribute. This marker is present in USJ but is translated into the `usx` marker in USX` and the `usfm` marker in USFM.
- [`esbe`](https://docs.usfm.bible/usfm/3.1/sbar/esb.html) with marker type `sidebar` and no default attribute. This marker is present in USFM but is a closing tag for `sidebar` in USX

Note: `fig` has an attribute that changes names: in USFM, it is `src`; in USX and USJ, it is `file`.

The definitions `ChapterEnd` and `VerseEnd` need to be skipped as they are not relevant to this map.


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
