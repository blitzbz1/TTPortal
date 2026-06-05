-- Keep database country names canonical English. UI translations should be
-- derived from country_code in the app/web clients.

WITH canonical(code, name) AS (
  VALUES
    ('AL', 'Albania'),
    ('AD', 'Andorra'),
    ('AT', 'Austria'),
    ('BA', 'Bosnia and Herzegovina'),
    ('BE', 'Belgium'),
    ('BG', 'Bulgaria'),
    ('BY', 'Belarus'),
    ('CH', 'Switzerland'),
    ('CY', 'Cyprus'),
    ('CZ', 'Czechia'),
    ('DE', 'Germany'),
    ('DK', 'Denmark'),
    ('EE', 'Estonia'),
    ('ES', 'Spain'),
    ('FI', 'Finland'),
    ('FR', 'France'),
    ('GB', 'United Kingdom'),
    ('GR', 'Greece'),
    ('HR', 'Croatia'),
    ('HU', 'Hungary'),
    ('IE', 'Ireland'),
    ('IS', 'Iceland'),
    ('IT', 'Italy'),
    ('LI', 'Liechtenstein'),
    ('LT', 'Lithuania'),
    ('LU', 'Luxembourg'),
    ('LV', 'Latvia'),
    ('MD', 'Moldova'),
    ('ME', 'Montenegro'),
    ('MK', 'North Macedonia'),
    ('MT', 'Malta'),
    ('NL', 'Netherlands'),
    ('NO', 'Norway'),
    ('PL', 'Poland'),
    ('PT', 'Portugal'),
    ('RO', 'Romania'),
    ('RS', 'Serbia'),
    ('SE', 'Sweden'),
    ('SI', 'Slovenia'),
    ('SK', 'Slovakia'),
    ('TR', 'Turkey'),
    ('UA', 'Ukraine'),
    ('XK', 'Kosovo')
)
UPDATE public.countries AS country
SET
  name = canonical.name,
  updated_at = now()
FROM canonical
WHERE country.code = canonical.code
  AND country.name IS DISTINCT FROM canonical.name;

WITH canonical(code, name) AS (
  VALUES
    ('AL', 'Albania'),
    ('AD', 'Andorra'),
    ('AT', 'Austria'),
    ('BA', 'Bosnia and Herzegovina'),
    ('BE', 'Belgium'),
    ('BG', 'Bulgaria'),
    ('BY', 'Belarus'),
    ('CH', 'Switzerland'),
    ('CY', 'Cyprus'),
    ('CZ', 'Czechia'),
    ('DE', 'Germany'),
    ('DK', 'Denmark'),
    ('EE', 'Estonia'),
    ('ES', 'Spain'),
    ('FI', 'Finland'),
    ('FR', 'France'),
    ('GB', 'United Kingdom'),
    ('GR', 'Greece'),
    ('HR', 'Croatia'),
    ('HU', 'Hungary'),
    ('IE', 'Ireland'),
    ('IS', 'Iceland'),
    ('IT', 'Italy'),
    ('LI', 'Liechtenstein'),
    ('LT', 'Lithuania'),
    ('LU', 'Luxembourg'),
    ('LV', 'Latvia'),
    ('MD', 'Moldova'),
    ('ME', 'Montenegro'),
    ('MK', 'North Macedonia'),
    ('MT', 'Malta'),
    ('NL', 'Netherlands'),
    ('NO', 'Norway'),
    ('PL', 'Poland'),
    ('PT', 'Portugal'),
    ('RO', 'Romania'),
    ('RS', 'Serbia'),
    ('SE', 'Sweden'),
    ('SI', 'Slovenia'),
    ('SK', 'Slovakia'),
    ('TR', 'Turkey'),
    ('UA', 'Ukraine'),
    ('XK', 'Kosovo')
)
UPDATE public.cities AS city
SET
  country_name = canonical.name,
  updated_at = now()
FROM canonical
WHERE city.country_code = canonical.code
  AND city.country_name IS DISTINCT FROM canonical.name;

NOTIFY pgrst, 'reload schema';
