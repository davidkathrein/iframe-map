# Adressen für „Kühle Orte im Walgau“

Stand: 24. Juli 2026

## Ergebnis

Eine automatische, **verlässliche Hausadresse für alle 79 Orte** ist nicht
realistisch: Ein Teil der Einträge sind Seen, Ruinen, Wald- oder
Freiflächen und haben keine postalische Anschrift. Die amtliche, gut
reproduzierbare Lösung ist daher: zuerst jeden Ort auf der Karte verorten;
anschließend die nächstgelegene amtliche Adresse nur dann anzeigen, wenn sie
nah genug liegt. Andernfalls bleibt die Gemeinde die Ortsangabe.

Der aktuelle Bestand in `src/data/places.json` enthält weder `address` noch
feste `coordinates`. Die dort verwendeten Namen und Gemeinden reichen für
eine reine Adresssuche nicht aus, weil sie oft keine postalischen Adressen
sind.

## Geeignete Quelle

Das **Österreichische Adressregister des BEV** ist die bevorzugte Quelle:

- Der Datensatz „Adressregister INSPIRE Stichtag“ liefert Adressen mit
  Geometrie als CSV oder GeoPackage. Die Referenzierung wird laut BEV laufend
  durch die Gemeinden fortgeführt.
- Seine Lizenz erlaubt die freie Nutzung; für abgeleitete Ergebnisse verlangt
  sie eine Quellenangabe im Format
  `© Österreichisches Adressregister, Stichtagsdaten vom TT.MM.JJJJ`.
- Damit ist ein lokaler, versionierbarer Import möglich, ohne eine
  nicht dokumentierte Such-Website automatisiert abzufragen.

Quelle: [BEV – Adressregister INSPIRE Stichtag](https://mobilitaetsdaten.gv.at/daten/adressregister-inspire)

Das kostenlose offizielle [Adresssuch-Portal des BEV](https://www.bev.gv.at/en/Services/Geoinformation-Services/Adress-search.html)
eignet sich zur Einzelprüfung von Treffern, dokumentiert jedoch keine frei
nutzbare Reverse- oder Batch-API. Der [BEV-Adresssuch-Service](https://www.bev.gv.at/Services/Geoinformationsdienste/Services/BEV-Adresssuch-Service.html)
ist eine kostenpflichtige, zertifikatsbasierte Vorwärtssuche und löst dieses
Problem daher nicht.

Das [Geoportal des Landes Vorarlberg](https://vogis.vorarlberg.at/) ist die
passende amtliche Kontrollquelle für die Verortung: Es stellt die Daten des
Landes bereit; der [Vorarlberg Atlas & das Geoportal](https://vorarlberg.at/-/atlas-vorarlberg)
beschreibt den Zugang zu rund 600 Datensätzen und die Suche nach Orten und
Adressen. Seine Treffer sollten nur übernommen werden, wenn Ort, Gemeinde und
Lage eindeutig zusammenpassen.

## Empfohlenes, reproduzierbares Vorgehen

1. **Stichtag festhalten:** Den aktuellen BEV-Download beziehen und
   Download-Datum/Stichtag in einer Import-Metadatei speichern.
2. **Orte verorten:** Für jeden Eintrag die Koordinate über den Vorarlberg
   Atlas prüfen und als `[Längengrad, Breitengrad]` in `places.json`
   hinterlegen. Unsichere Treffernamen werden manuell geprüft; Namen allein
   sind kein automatischer Qualitätsnachweis.
3. **Amtliche Nachbaradresse bestimmen:** Das heruntergeladene
   Adressregister lokal auf Vorarlberg beschränken und pro Ortskoordinate die
   nächstgelegene Adresse berechnen (z. B. mit QGIS oder einem kleinen
   Node/Python-Importskript). Ergebnisfelder: Straße, Hausnummer, PLZ, Ort,
   Distanz in Metern und BEV-Stichtag.
4. **Strenge Übernahme-Regel:** Nur Adressen mit Distanz `≤ 100 m` und
   passender Gemeinde als `address` ausspielen. Darüber nur z. B.
   `Schnifis, Vorarlberg` anzeigen. Das verhindert, dass bei Seen, Gipfeln
   und Waldplätzen eine irreführende Hausadresse erscheint.
5. **Review und Nachweis:** Alle angenommenen Adressen einmal gegen den Atlas
   prüfen; abgeleitete Daten mit der vorgeschriebenen BEV-Quellenangabe
   ausliefern. Orte ohne Anschrift erhalten bewusst keine künstliche Adresse.

## Datenmodell-Vorschlag

```json
{
  "municipality": "Schnifis",
  "name": "Fallersee",
  "coordinates": [9.73, 47.21],
  "address": null,
  "nearestOfficialAddress": {
    "label": "Musterstraße 12, 6822 Schnifis",
    "distanceMeters": 83,
    "source": "BEV Adressregister INSPIRE",
    "referenceDate": "YYYY-MM-DD"
  }
}
```

Für die Oberfläche sollte `address` nur angezeigt werden, wenn es eine
tatsächliche Besucheradresse gibt. `nearestOfficialAddress` ist dagegen ein
interner Prüfwert; er sollte nicht als Adresse des Ausflugsziels bezeichnet
werden.

## Beurteilung

Die Umsetzung ist für 79 Einträge gut machbar. Sie benötigt jedoch eine
einmalige manuelle Verortung und Qualitätskontrolle, weil die meisten
Ortsnamen keine eindeutigen postalischen Adressobjekte bezeichnen. Das
amtliche BEV-Register bietet die höchste Datenqualität für die anschließend
angezeigten Adressen; eine Drittanbieter-Reverse-API wäre hierfür weder
notwendig noch gleichwertig nachvollziehbar.
