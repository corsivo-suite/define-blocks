# Changelog

## Non rilasciato — Versione 1.1.0

- Rigenerati i bundle contro i package condivisi correnti, includendo il refresh visuale e gli asset RTL; contratti runtime invariati.
- Aggiunto `inline => true` ai figli diretti dei repeater per renderli nell'header senza duplicarli nel corpo espanso.
- Aggiunta la variante compatta a swatch del campo `color` quando usato inline.
- Allineata la grafica dei repeater a un elenco continuo senza gap o ombre, con icone outline.
- Migrato definitivamente il registry dei field sugli adapter di `@corsivo-suite/wp-admin-ui` e `@corsivo-suite/wp-admin-maps`, mantenendo invariati schema PHP, store, hook e formati salvati.
- Portati nei package i controlli URL, link, media, file, gallery, video, selettori asincroni, chip, taxonomy, entity selector, colore, date/time, repeater e sortable; rimossi i componenti e gli asset legacy sostituiti.
- Allineate le mappe alla separazione controlled tra query e indirizzo, alle coordinate parziali, al canvas iframe, al drag del marker, al reverse geocoding protetto dalle race condition e allo zoom con `Ctrl` + rotella.
- Corrette le regressioni del porting su ricerca URL, autofill del titolo link, palette colori, shape media/gallery, coordinate negative e sincronizzazione controlled.
- Completata la localizzazione delle stringhe operative e accessibili dei nuovi controlli nel dominio `define-blocks`.
- Demandato al loader del package il caricamento di Google Maps, eliminando il secondo script globale dell'editor.
- Mantenuta la distribuzione autonoma del plugin tramite gli asset compilati in `editor/build`, senza dipendenze runtime dal monorepo Corsivo; il sorgente usa i package privati `@corsivo-suite/*` alla versione esatta `0.1.0`.
- Allineati header e costante del plugin alla versione `1.1.0`; i colori alpha sono ora preservati dalla sanitizzazione PHP.

### Verifiche

- 42 test Define Blocks e 135 test dei package completati; lint JavaScript/SCSS, build, lint PHP, package dry-run e runtime audit verdi.
- I warning sulla dimensione dei bundle Define Blocks e showcase sono non bloccanti.
- Lo smoke test Gutenberg nel browser non è stato eseguito perché non era disponibile una sessione WordPress autenticata; resta da validare il plugin su un'installazione reale WordPress 6.6.

---

## 2026-07-16 — Versione 1.0.8

- Corretto il salvataggio dei campi `saveInMeta`: l'assenza di un blocco dal documento non elimina più meta registrati dallo stesso schema o gestiti da altre interfacce.

---

## 2026-07-10 — Versione 1.0.5

- Rimossi `react-leaflet` e `mapbox-gl` dal bundle editor.
- Migrati `osm-map` e `mapbox-map` a Leaflet diretto mantenendo ricerca, click, pin trascinabile, reverse geocoding e sincronizzazione esterna.
- Gli stili Mapbox vengono caricati tramite Static Tiles API, senza distribuire il relativo SDK proprietario.
- Protette le richieste geocoding da race condition e aggiornamenti dopo l'unmount.
- Aggiunti test per la risoluzione degli stili raster e le notice delle dipendenze distribuite.

---

## 2026-07-10 — Versione 1.0.4

- Allineata la compatibilità minima a WordPress 6.6 e uniformato il versioning.
- Corretti preview server-side, InnerBlocks, persistenza dei default e read API.
- Rafforzati endpoint REST, validazione editor e gestione dei repeater.
- Corretti Taxonomy, Mapbox nel canvas iframe, traduzioni JavaScript e asset RTL.
- Aggiunti lockfile, lint e test unitari per la logica editor.

---

## 2026-07-09 — Ripristino field geo avanzati

- Ripristinati `google-geocoder`, `mapbox-map`, `mapbox-geocoder` e `osm-geocoder` dal vecchio ramo geo, integrandoli nel registry attuale.
- Aggiunto filtro `defb_mapbox_key` con fallback legacy `define_blocks_mapbox_key`; `defb_google_maps_key` accetta anche il fallback legacy `define_blocks_google_maps_key`.
- I valori mappa/geocoder ora mantengono sia `lat`/`lng` sia `latitude`/`longitude`, più `address`/`formatted_address`, per compatibilità tra vecchi e nuovi blocchi.
- Build editor aggiornata; Mapbox viene caricato in chunk separato via lazy import.

---

## 2026-06-10 — Support `spacing` reso opt-in + blocco demo-fields

### Richiesta (1): Support `spacing` reso opt-in
Il support `spacing` (margini, padding, blockGap — il pannello "Dimensioni" di Gutenberg) era abilitato di default su ogni blocco; renderlo opt-in: appare solo se dichiarato esplicitamente in `supports` nella dichiarazione del blocco.

### Modifiche effettuate
- `includes/register.php`: rimossa la voce `'spacing' => [ 'margin' => true, 'padding' => true, 'blockGap' => true ]` da `defb_default_supports()`. Restano di default: align, alignWide, html, customClassName, color. Nessuna modifica al merge in `defb_block_supports()`: i supports dichiarati dal blocco passano as-is.
- `README.md`: aggiornata la sezione "Block supports": rimosso spacing dai default documentati, aggiunto esempio opt-in con `spacing` e `dimensions`.
- `readme.txt`: aggiornata la frase sui supports standard (spacing ora indicato come opt-in).

### Note
Impatto su blocchi esistenti: quelli senza `supports.spacing` dichiarato perdono il pannello Dimensioni e gli eventuali valori margin/padding già salvati non vengono più applicati al render finché il support non viene dichiarato.

---

### Richiesta (2): Blocco demo con tutti i tipi di campo
Creare un blocco di demo che copra l'intera surface del plugin per testare tutti i tipi di campo del registry in un unico posto.

### Modifiche effettuate
- `salvatorecorsi-plugin/includes/blocks/demo-fields.php`: blocco `salvatorecorsi/demo-fields` con tutti e 31 i tipi di campo del registry (text, number, text-with-parser, textarea, richtext, select statico/remoto, multi-select, autocomplete statico/remoto, multi-autocomplete, chips, checkbox, media con focal point, file, gallery, video, color, url, link con ricerca, range, date, time, datetime, post-selector, taxonomy con allowCreate, repeater, group, tabpanels, innerblocks, google-map, osm-map, hidden, value, title), tutti gli scope (content, 3 panel inspector, inspector-advanced, toolbar con toolbar-select/toggle/input/autocomplete/dropdown, scope toolbar-dropdown), condition array/stringa/conditionHide, saveInMeta, validate (array required + callable con messaggio), saveCallback, width 50/50, defaults, supports spacing+dimensions opt-in, settings frontendPreview+canCollapse, wrapperClass. Render = dump JSON dei values + contenuto InnerBlocks.
- `README.md`: corretto `post_type` → `postType` nell'esempio del post-selector; i componenti JS leggono `field.postType` e non esiste normalizzazione snake→camel in `defb_prepare_field()`, quindi la chiave documentata era sbagliata. Annotato che la stessa chiave abilita la ricerca remota su select, autocomplete, multi-autocomplete e link.

---

## 2026-06-09 — Review completa e bonifica del plugin (~39 file)

### Richiesta
Check completo del plugin Define Blocks con fix di tutti i problemi trovati: review dell'intero codebase (PHP + JS editor + field components), bonifica dei bug critici e refactor dello store editor. Build rifatta al termine.

### Modifiche effettuate

**PHP — `includes/api.php`**
- `/defb/v1/posts/search` e `/posts/list`: il valore `'all'` per `post_type` ora viene espanso nei public post types reali (prima `WP_Query` riceveva il literal `'all'` → 0 risultati); endpoint accettano sia GET che POST
- Aggiunti helper `defb_excluded_post_types()` e `defb_searchable_post_types()`
- REST `/render`: passa al callback la stessa shape del frontend (`['values' => ...]`), applica i default mancanti, setta il contesto post con `global $post` + `setup_postdata` / `wp_reset_postdata`
- `/meta`: ora matcha le chiavi esatte (rimosso `sanitize_key` che rompeva le maiuscole), usa la mappa per `post_id`, sanitizza `hidden`/`value` con `defb_sanitize_deep`
- `update_post_meta` ora usa `wp_slash`

**PHP — rendering e defaults**
- `defb_block_supports()`: supports unificati e inviati anche all'editor (align/color/spacing ora visibili)
- Default dei campi mergiati in `attrs['values']` lato frontend (blocco lasciato ai default non renderizzava più senza valori)
- Alias dei tipi campo: ora preservano `originalType`, riattiva la pipeline `number` in `TextInput`/`ToolbarInput`/`Dispatcher`
- `defb_collect_defaults`, `defb_run_field_saves`, `defb_meta_field_map`: ricorsione nei sub-field dei repeater esclusa (prima produceva chiavi spurie nei defaults e meta sovrascritti con null)
- `defb_strip_closures`: rimuove anche callable string/array (render/validate/saveCallback non finiscono più nel JSON client)

**PHP — `includes/extend.php` e enqueue**
- Dipendenze media (`media-editor` ecc.) caricate solo se il blocco usa campi media/gallery/file/video
- `register-save.js` dipende solo da `wp-data`/`wp-hooks`
- Guard su `index.asset.php` mancante
- `extend.php` copre il site editor e legge l'`asset.php` dei custom field

**Editor JS — store (`editor/src/store/`)**
- `BlockProvider` riscritto: eliminato `useReducer`; valori in ref + context memoizzato + canale `subscribeAny`; un keystroke non ri-renderizza più tutti i campi del blocco
- `reducer.js` eliminato
- Undo/redo ora aggiorna correttamente i campi (adozione cambi esterni di `attributes.values`)
- Errori di validazione "fantasma" risolti (revalidate dei campi in errore a ogni save)

**Editor JS — `Dispatcher.js`**
- Visibilità condition-based via subscription con re-render solo al flip
- Campo `hidden` senza wrapper (eliminato il buco nel layout)

**Editor JS — `Repeater.js` / `RepeaterItem.js`**
- `_defb_id` persistiti via `onChange` (niente più remount delle righe a ogni render)
- `RepeaterItem` usa `getData`/`subscribeAny` per root nelle condition

**Editor JS — vari**
- `conditions.js`: tokenizer supporta field name kebab-case
- `validation.js`: rimosso scope `toolbar-dropdown` morto
- `Edit.js` / `RepeaterItem.js`: header collassabili gestiscono anche Space
- Category default `'widgets'` (era `'common'`, rimossa da WP 5.5)
- `BlockPreview`: wrapper `.defb-preview` lato client e `isEmpty` funzionante

**Field components**
- `Gallery`: `activationConstraint` su dnd-kit sensors — il bottone rimozione immagine ora funziona
- `Url` / `Link` / `Autocomplete` / `ChipsInput`: race guard `searchSeq` + cleanup timer; ricerche convertite a GET
- Nuovo hook `usePostsList` con cache module-level: `posts/list` non rifetchato a ogni mount/tab switch (usato da `Select`, `ToolbarAutocomplete`)
- `Time`: parse locale dei valori date-only (fix off-by-one nei fusi UTC-negativi)
- `Taxonomy`: niente più chip corrotte su creazione termine fallita; recupero `term_exists`; `restBase` risolto dal core store
- `GoogleMap` / `OsmMap`: lat/lng committati su blur/Enter invece che a ogni cifra
- `PostSelector`: spinner durante la ricerca
- A11y: label associate via `useInstanceId` in molti campi; `__nextHasNoMarginBottom` uniformato

### Note
- Verifiche finali: `php -l` pulito su tutti i file (PHP 8.1), `npm run build` ok
- Modifiche non ancora committate al momento della registrazione

---
