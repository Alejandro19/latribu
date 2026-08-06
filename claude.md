Hola, soy alejandro

## Reglas de lectura de archivos

- Antes de leer cualquier archivo > 50 KB, pedir confirmación explícita al usuario.
- No leer `index.html` completo salvo que sea estrictamente necesario — usar Grep/Read con offset+limit.
- No explorar `node_modules/`, `build/`, `dist/`, `.git/`.
- Preferir búsquedas dirigidas (Grep, Glob) sobre lecturas completas de archivos grandes.
