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

This script reads the USX RelaxNG Schema file [`usx.rng`](https://github.com/usfm-bible/tcdocs/blob/main/grammar/usx.rng) and generates a JSON file `markers.json` that contains the marker type for each USFM marker. `markers.json` will contain an object with information about the generated file and a `markers` property whose value is a map object whose keys are the markers and whose values are objects containing the marker type:

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
          "type": "ms"
      },
      ...
  }
}
```

The markers and types are derived from the `usx.rng` file. It contains information about each valid USFM marker. Following are some examples of the definitions of markers from which we gather the markers and types:

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

  ...

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
