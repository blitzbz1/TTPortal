# OSM → TTPortal venue import — REPORT

Source: tables.json (47209 OSM points) → Overture Maps `2026-05-20.0` + GeoNames.

## Totals
- Input points: **47209**
- **Venues emitted: 33330**  across **10291 cities** / **44 countries**
- Tables represented (co-located same-name tables merged into one venue): 44914
- Venues that merged ≥2 co-located tables: 8385
- Distant same-name venues kept separate (suffixed ' (2)'…): 1726

## Dropped (2295)
| reason | count |
|---|---|
| within 100 m of an existing venue (precedence) | 103 |
| no resolvable place/street name | 2189 |
| no city within 30 km | 1 |
| no country | 2 |
| failed validation | 0 |

## Name source
| source | count |
|---|---|
| OSM own name | 1048 |
| containing park/square | 23629 |
| nearby POI (≤150 m) | 6803 |
| nearest street | 13434 |
| other named area | 0 |

## Per country (venues / tables / cities)
| cc | country | venues | tables | cities |
|---|---|---|---|---|
| DE | Germany | 13376 | 18653 | 2882 |
| CH | Switzerland | 5504 | 7574 | 1007 |
| FR | France | 4990 | 6516 | 2768 |
| NL | The Netherlands | 1793 | 1952 | 556 |
| PL | Poland | 1623 | 2084 | 465 |
| ES | Spain | 930 | 1312 | 431 |
| CZ | Czechia | 649 | 811 | 283 |
| GB | United Kingdom | 638 | 903 | 349 |
| RU | Russia | 583 | 789 | 136 |
| AT | Austria | 502 | 662 | 168 |
| IT | Italy | 436 | 570 | 247 |
| BE | Belgium | 347 | 407 | 234 |
| HU | Hungary | 270 | 355 | 70 |
| NO | Norway | 253 | 366 | 78 |
| SK | Slovakia | 239 | 307 | 72 |
| EE | Estonia | 217 | 284 | 44 |
| HR | Croatia | 161 | 266 | 54 |
| UA | Ukraine | 131 | 161 | 54 |
| DK | Denmark | 95 | 117 | 52 |
| BG | Bulgaria | 85 | 142 | 13 |
| SE | Sweden | 80 | 101 | 47 |
| FI | Finland | 62 | 77 | 40 |
| PT | Portugal | 58 | 74 | 50 |
| BY | Belarus | 37 | 61 | 18 |
| LV | Latvia | 37 | 53 | 21 |
| SI | Slovenia | 34 | 49 | 16 |
| LT | Lithuania | 30 | 40 | 12 |
| GR | Greece | 26 | 34 | 23 |
| LU | Luxembourg | 26 | 32 | 19 |
| RS | Serbia | 22 | 31 | 15 |
| ME | Montenegro | 21 | 30 | 5 |
| TR | Turkey | 18 | 23 | 16 |
| GE | Georgia | 12 | 17 | 7 |
| IE | Ireland | 11 | 15 | 11 |
| MD | Moldova | 7 | 10 | 5 |
| BA | Bosnia and Herzegovina | 6 | 8 | 6 |
| LI | Liechtenstein | 5 | 6 | 4 |
| AL | Albania | 4 | 7 | 2 |
| AM | Armenia | 4 | 4 | 4 |
| CY | Cyprus | 2 | 3 | 2 |
| IS | Iceland | 2 | 2 | 2 |
| MC | Monaco | 2 | 4 | 1 |
| DZ | Algeria | 1 | 1 | 1 |
| IR | Iran | 1 | 1 | 1 |

## Samples (top 5 countries)

### DE — Germany
  - Ludwig-Meyn-Gymnasium  —  Bleekerstraße 8, Uetersen
  - Michelwiese  —  Martin-Luther-Straße 35, Hamburg
  - Auguststraße  —  Auguststraße 34, Bremen
  - Rennstieg  —  Rennstieg 77, Bremen
  - Im Krummen Arm  —  Linienstraße 49, Bremen
  - Abenteuerspielplatz  —  Repgowstieg 55, Hamburg
  - Steindammwiesen  —  Steindamm 26, Elmshorn
  - Gesamtschule West  —  Lissaer Straße 7, Bremen
  - Altes Gymnasium  —  Karolinastraße 7, Bremen
  - Bürgerpark  —  Hollerallee 99, Bremen
  - Neue Oberschule Gröpelingen  —  Humannstraße 69, Ritterhude
  - Oberschule Habenhausen  —  Bunnsackerweg 2, Bremen

### CH — Switzerland
  - Tischtennis Schule Im Birch  —  Margrit-Rainer-Strasse 6, Grossacker/Opfikon
  - Tischtennis Jardin Henriette Grandjean  —  Rue du Doubs 92, La Chaux-de-Fonds
  - Tischtennis Sportanlage Mitteldorf  —  Hauptstrasse 45a, Derendingen
  - Tischtennis Seeschule  —  Seestrasse 128.1, Steckborn
  - Tischtennis Schule Leutschenbach  —  Saatlenfussweg 3, Grossacker/Opfikon
  - Tischtennis Strandbad Tribschen  —  Warteggstrasse 44.1, Luzern
  - Tischtennis Lindengarten  —  Taubenhausstrasse 8, Luzern
  - Tischtennis Aufschütte - Ufschötti  —  Alpenquai 25, Luzern
  - Tischtennis Aufschütte - Ufschötti (2)  —  Alpenquai 25, Luzern
  - Tischtennis Vögeligärtli  —  Frankenstrasse 9.20, Luzern
  - Tischtennis Oberstufenzentrum Mariahilf  —  Mariahilfgasse 4.1, Luzern
  - Tischtennis Wey-Pärkli  —  Stadthofstrasse 14, Luzern

### FR — France
  - Tennis de table Parc Vignières-Pommaries  —  Impasse des Vergers 13, Annecy-le-Vieux
  - Tennis de table Parc de la Carterie  —  Rue Pierre Brossolette 4e, Rezé
  - Tennis de table Jardin Damia  —  Passage du Bureau 25, Paris 11 Popincourt
  - Complexe Tennis de Table Niort  —  Rue Gustave Flaubert 46, Niort
  - Tennis de table La Frominette  —  Rue des Bateliers 20, Saint-Senoux
  - Tennis de table Parc des Couronnes  —  Avenue Léon Bourgain 14, Asnières-sur-Seine
  - Tennis de table Base de loisirs de Léry-Pose Léry  —  CD 110 2, Le Manoir
  - Tennis de table Parc du Tiers-État  —  Rue Monge 5, Poitiers
  - Tennis de table Jardin des Tournelles  —  Rue Du Président Kruger 25, Courbevoie
  - Tennis de table Camping de la Vallée  —  Lotissement Marcharnd 8, Houlgate
  - Tennis de table Square Voyer d'Argenson  —  Rue du Château 99, Asnières-sur-Seine
  - Tennis de table CHM Montalivet  —  Avenue de l'Europe 46, Vendays-Montalivet

### NL — The Netherlands
  - Tafeltennis Universitair Medisch Centrum Groningen  —  Vrydemalaan 17, Groningen
  - Tafeltennis CBS De Parel  —  Kerkstraat 108, Veendam
  - Tafeltennis Rutger Kopland VO Eemsdelta  —  Poststraat 1, Siddeburen
  - Tafeltennis Stortemelk  —  Kampweg 1, Oost-Vlieland
  - Tafeltennis Landal Suyderoogh  —  De Rug 5, Zoutkamp
  - Tafeltennis Dier- en speelweide 'Witte Winde'  —  Stachouwerstraat 2, Schiermonnikoog
  - Tafeltennis CSG Comenius – locatie Zamenhof  —  Robert Kochstraat 31, Leeuwarden
  - Tafeltennis Oranjetuin  —  Oranje-Nassaupark 1, Leeuwarden
  - Tafeltennis GBS De Parel  —  Aletta Jacobsweg 78, Assen
  - Tafeltennis Comenius Mariënburg  —  Achter de Hoven 116k, Leeuwarden
  - Tafeltennis Durperhonk  —  Schipper Boonstraat 18, De Koog
  - Tafeltennis Kindcentrum SPEEL en LEER  —  Kerklaan 3A, Haulerwijk

### PL — Poland
  - Tenis stołowy Centrum Kształcenia Sportowego  —  Mazurska 40, Szczecin
  - Tenis stołowy Plac Dziecka  —  Plac Dziecka 13, Szczecin
  - Tenis stołowy Zespół Szkół Ogólnokształcących  —  Stefana Żeromskiego 1, Hel
  - Tenis stołowy Park Diany  —  Diany 32, Osowa
  - Tenis stołowy Piernikowe Miasteczko  —  Podmurna 60, Toruń
  - Tenis stołowy Skwer imienia Telesfora Badetko  —  Spółdzielcza 70, Szczecin
  - Tenis stołowy Szkoła Podstawowa nr 8 imienia Jana Pawła II  —  Piaskowa 99a, Police
  - Tenis stołowy Os. Dolne Miasto  —  Osiedle Dolne Miasto 14A, Wałcz
  - Tenis stołowy Jar Wilanowski  —  prof. Romualda Cebertowicza 19, Ujeścisko-Łostowice
  - Tenis stołowy Szkoła Podstawowa nr 3 im. Juliusza Słowackiego  —  Władysława Stanisława Reymonta 23, Szczecin
  - Tenis stołowy Szkoła Podstawowa nr 12 im. Konstantego Ildefonsa Gałczyńskiego  —  Krzemienna 42a, Szczecin
  - Tenis stołowy Plac Trzech Pokoleń  —  Perłowa 12, Kołobrzeg
