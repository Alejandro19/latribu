-- Edad Biológica (PhenoAge, Levine et al. 2018) — Evolution / Ephi-Metrics.
-- Se calcula y guarda una sola vez por checkpoint, en el momento en que el
-- admin aprueba el panel (ver approveLabPanel), usando la edad cronológica
-- del cliente EN LA FECHA del panel (no la edad actual) — por eso se
-- congela acá en vez de recalcularla al vuelo desde clients.birthdate.
ALTER TABLE lab_panels
  ADD COLUMN edad_biologica numeric(5, 2),
  ADD COLUMN edad_cronologica_calculo numeric(5, 2),
  ADD COLUMN edad_biologica_calculada_en timestamptz;
