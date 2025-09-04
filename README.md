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

## Generate Marker Type Map

Generate the marker type map by placing the USX RelaxNG Schema file [`usx.rng`](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng) in the root of this repo and running `npm run generate-markers-map -- --schema usx.rng --version <schema-version>`.

This script reads the USX RelaxNG Schema file [`usx.rng`](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng) and generates a JSON file `markers.json` that contains various information for each USFM marker name. `markers.json` will contain an object with information about the generated file and a `markers` property whose value is a map object whose keys are the marker names and whose values are objects containing information about the marker such as the marker type and the marker's default attribute (where applicable):

```json
{
  "version": "3.2",
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
  }
}
```

The marker names and information about those markers are derived from the `usx.rng` file. This schema file contains information about each valid USFM marker:
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
            - all attributes on `usx` marker type
            - `code` on `book` marker type
            - all attributes on `periph` marker type
            - `style` on any marker type
            - `vid` on `para` and `table` marker types
            - all attributes on `chapter` marker type
            - all attributes on `verse` marker type
            - `caller` and `category` on `note` marker type
            - `category` on `sidebar` marker type
        - Exception: For `ms` marker types, `who` takes priority over other attributes if it is present.

There is also a marker named `cat` with marker type `cat` and no default attribute that is not listed in `usx.rng` that needs to be present in `markers.json`.


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

Following is a snippet from the schema that is an example of many marker names that share a marker type:

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
