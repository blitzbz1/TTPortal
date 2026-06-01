# OSM → TTPortal venue import — REPORT

Source: tables.json (47209 OSM points) → Overture Maps `2026-05-20.0` + GeoNames.

## Totals
- Input points: **47209**
- **Venues emitted: 44914**  across **10291 cities** / **44 countries**
- Cluster names disambiguated with a suffix: 13314

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

## Per country (venues / cities)
| cc | country | venues | cities |
|---|---|---|---|
| DE | Germany | 18653 | 2882 |
| CH | Switzerland | 7574 | 1007 |
| FR | France | 6516 | 2768 |
| PL | Poland | 2084 | 465 |
| NL | The Netherlands | 1952 | 556 |
| ES | Spain | 1312 | 431 |
| GB | United Kingdom | 903 | 349 |
| CZ | Czechia | 811 | 283 |
| RU | Russia | 789 | 136 |
| AT | Austria | 662 | 168 |
| IT | Italy | 570 | 247 |
| BE | Belgium | 407 | 234 |
| NO | Norway | 366 | 78 |
| HU | Hungary | 355 | 70 |
| SK | Slovakia | 307 | 72 |
| EE | Estonia | 284 | 44 |
| HR | Croatia | 266 | 54 |
| UA | Ukraine | 161 | 54 |
| BG | Bulgaria | 142 | 13 |
| DK | Denmark | 117 | 52 |
| SE | Sweden | 101 | 47 |
| FI | Finland | 77 | 40 |
| PT | Portugal | 74 | 50 |
| BY | Belarus | 61 | 18 |
| LV | Latvia | 53 | 21 |
| SI | Slovenia | 49 | 16 |
| LT | Lithuania | 40 | 12 |
| GR | Greece | 34 | 23 |
| LU | Luxembourg | 32 | 19 |
| RS | Serbia | 31 | 15 |
| ME | Montenegro | 30 | 5 |
| TR | Turkey | 23 | 16 |
| GE | Georgia | 17 | 7 |
| IE | Ireland | 15 | 11 |
| MD | Moldova | 10 | 5 |
| BA | Bosnia and Herzegovina | 8 | 6 |
| AL | Albania | 7 | 2 |
| LI | Liechtenstein | 6 | 4 |
| AM | Armenia | 4 | 4 |
| MC | Monaco | 4 | 1 |
| CY | Cyprus | 3 | 2 |
| IS | Iceland | 2 | 2 |
| DZ | Algeria | 1 | 1 |
| IR | Iran | 1 | 1 |

## Samples (top 5 countries)

### DE — Germany
  - Tischtennis Ludwig-Meyn-Gymnasium  —  Bleekerstraße 8, Uetersen
  - Tischtennis Michelwiese  —  Martin-Luther-Straße 35, Hamburg
  - Tischtennis Auguststraße  —  Auguststraße 34, Bremen
  - Tischtennis Rennstieg  —  Rennstieg 77, Bremen
  - Tischtennis Im Krummen Arm  —  Linienstraße 49, Bremen
  - Tischtennis Abenteuerspielplatz  —  Repgowstieg 55, Hamburg
  - Tischtennis Steindammwiesen  —  Steindamm 26, Elmshorn
  - Tischtennis Gesamtschule West  —  Lissaer Straße 7, Bremen
  - Tischtennis Altes Gymnasium  —  Karolinastraße 7, Bremen
  - Tischtennis Altes Gymnasium (2)  —  Karolinastraße 7, Bremen
  - Tischtennis Altes Gymnasium (3)  —  Karolinastraße 8, Bremen
  - Tischtennis Altes Gymnasium (4)  —  Karolinastraße 8, Bremen

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

### PL — Poland
  - Tenis stołowy Centrum Kształcenia Sportowego  —  Mazurska 40, Szczecin
  - Tenis stołowy Centrum Kształcenia Sportowego (2)  —  Generała Ludomiła Rayskiego 9, Szczecin
  - Tenis stołowy Plac Dziecka  —  Plac Dziecka 13, Szczecin
  - Tenis stołowy Zespół Szkół Ogólnokształcących  —  Stefana Żeromskiego 1, Hel
  - Tenis stołowy Park Diany  —  Diany 32, Osowa
  - Tenis stołowy Piernikowe Miasteczko  —  Podmurna 60, Toruń
  - Tenis stołowy Piernikowe Miasteczko (2)  —  Podmurna 68, Toruń
  - Tenis stołowy Skwer imienia Telesfora Badetko  —  Spółdzielcza 70, Szczecin
  - Tenis stołowy Szkoła Podstawowa nr 8 imienia Jana Pawła II  —  Piaskowa 99a, Police
  - Tenis stołowy Szkoła Podstawowa nr 8 imienia Jana Pawła II (2)  —  Piaskowa 99a, Police
  - Tenis stołowy Os. Dolne Miasto  —  Osiedle Dolne Miasto 14A, Wałcz
  - Tenis stołowy Os. Dolne Miasto (2)  —  Osiedle Dolne Miasto 14A, Wałcz

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
  - Tafeltennis Comenius Mariënburg (2)  —  Achter de Hoven 116k, Leeuwarden
  - Tafeltennis Durperhonk  —  Schipper Boonstraat 18, De Koog
