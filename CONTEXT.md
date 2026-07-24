# Karte der kühlen Orte im Walgau

Eine eingebettete, kuratierte Karte, die Orte zur Abkühlung und zum Aufenthalt im Walgau auffindbar macht.

## Sprache

**Kühler Ort**:
Ein kuratierter, öffentlich auffindbarer Ort im Walgau, der durch Wasser, Schatten, Höhenlage oder Natur als angenehmer Aufenthaltsort bei Wärme geeignet ist.
_Avoid_: Sehenswürdigkeit, POI, Location

**Ortseintrag**:
Die redaktionelle Darstellung eines kühlen Orts mit Name, Gemeinde, Geoposition, Bild, Beschreibung und optionalen Merkmalen.
_Avoid_: Marker, Datensatz

**Merkmal**:
Eine zu einem Ortseintrag gehörende, filterbare Eigenschaft wie Gewässer, Schatten, Park oder Aussicht.
_Avoid_: Kategorie, Typ

**Anzeige-Icon**:
Das pro Ortseintrag festgelegte primäre Lucide-Symbol im Kartensymbol. Es fasst den dominanten Charakter des Ortes visuell zusammen, ohne seine mehreren Merkmale zu ersetzen.
_Avoid_: Merkmal, Filter

**Iconfamilie**:
Die feste Auswahl primärer Anzeige-Icons: Gewässer (`Waves`), Park & Ruhe (`TreePine`), Wald & Natur (`Trees`), Aussicht & Höhe (`Mountain`), Familie & Spiel (`PersonStanding`) und Geschichte & Kultur (`Landmark`).
_Avoid_: beliebige Symbolsammlung, unkontrollierte Icons

**Filterauswahl**:
Die frei kombinierbare Menge von Merkmalen, nach denen Ortseinträge auf der Karte gezeigt werden. Ein Ortseintrag kann mehrere Merkmale erfüllen; bei mehreren ausgewählten Merkmalen erscheint er, sobald er mindestens eines erfüllt.
_Avoid_: Einzelkategorie, exklusiver Filter, Schnittmengenfilter

**Ortskarte**:
Die responsive Detailansicht eines Ortseintrags nach Auswahl seines Kartensymbols. Sie zeigt Bild, Name, Gemeinde und Beschreibung; auf Mobilgeräten erscheint sie am unteren Kartenrand.
_Avoid_: Tooltip, Popup

**Ortsverzeichnis**:
Die im Projekt versionierte JSON-Quelle aller Ortseinträge und ihrer redaktionellen Angaben.
_Avoid_: CMS, Tabelle, Datenbank

**Kartengeometrie**:
Die aus Ortsname und Gemeinde abgeleitete räumliche Angabe eines Ortseintrags: eine Punktposition oder ein Flächenpolygon. Sie wird direkt aus dem Ortsverzeichnis angezeigt.
_Avoid_: Prüfgeometrie, Freigabegeometrie

**Punktort**:
Ein Ortseintrag mit einer klaren, einzelnen Geoposition, dargestellt durch ein Kartensymbol.
_Avoid_: Stecknadel, Pin

**Flächenort**:
Ein räumlich ausgedehnter Ortseintrag, dessen GeoJSON-Polygon als dezente, anklickbare Kartenfläche erscheint.
_Avoid_: großer Pin, Region ohne Geometrie

**Ortsbild**:
Ein optionales, freigegebenes Bild, das einen Ortseintrag in seiner Ortskarte visuell ergänzt.
_Avoid_: Pflichtbild, Stockfoto

**Einbettungskarte**:
Die eigenständig ausgelieferte Karte, die auf einer Partnerseite innerhalb eines iFrames angezeigt wird.
_Avoid_: Website-Unterseite, native Kartenansicht

**Routenlink**:
Ein Link aus einer Ortskarte zu Google Maps, die eine Wegbeschreibung zum ausgewählten Ort erstellt.
_Avoid_: integrierte Navigation, Anfahrtsbeschreibung

**Veröffentlichter Ortseintrag**:
Ein Ortseintrag aus dem Ortsverzeichnis, der auf der Einbettungskarte sichtbar ist. Seine Sichtbarkeit wird durch das Ortsverzeichnis bestimmt, nicht durch einen separaten Prüfprozess.
_Avoid_: Freigabestatus, Prüfworkflow

**Besuchshinweis**:
Ein unaufdringlicher Hinweis zu Rücksichtnahme, Zugänglichkeit und Eigenverantwortung beim Besuch der Orte.
_Avoid_: Haftungsausschluss, Warnbanner

**Ortscluster**:
Eine zusammengefasste Darstellung mehrerer nahe beieinanderliegender Ortseinträge bei geringer Kartenvergrößerung; sie löst sich beim Hineinzoomen in einzelne Ortsmarker auf.
_Avoid_: Marker-Stapel, Sammelpin

**Kartenstart**:
Der anfängliche Zustand der Einbettungskarte mit Überblick über den Walgau, sichtbaren Ortsclustern und nicht vorausgewählten Merkmalen.
_Avoid_: vorausgewählter Ort, gefilterte Startansicht

**Kartenfläche**:
Die großformatige, über die volle verfügbare Seitenbreite eingebettete Darstellung der Karte als nahezu eigenständiger Seitenbereich.
_Avoid_: Karten-Widget, kleine Vorschau

**Kartenintro**:
Die kompakte, schwebende Einordnung am Kartenrand mit Titel, kurzem Nutzenversprechen und Zugriff auf die Merkmalsfilter.
_Avoid_: Seitenhero, lange Einführung

**Kurzbeschreibung**:
Ein redaktioneller Text von höchstens etwa 250 Zeichen, der den Charakter und Nutzen eines Ortseintrags beschreibt.
_Avoid_: Langtext, Reiseführerartikel

**Kartenattribution**:
Der erforderliche Hinweis auf Karten- und Datendienste, der anfangs sichtbar ist und nach der ersten Karteninteraktion platzsparend eingeklappt wird.
_Avoid_: Werbebanner, dauerhaft offene Fußzeile

**Kartenstil**:
Die helle, ruhige und naturbezogene visuelle Gestaltung der Karte. Sie nutzt kühle Blau- und Grüntöne und besitzt keinen Dark Mode.
_Avoid_: Satellitenkarte, Dark Mode
