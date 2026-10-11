# Changelog

## 2026-10-11 — Non rilasciato: Correzioni della review

### Richiesta
Correggere tutti i sette problemi rilevati nella review del plugin e pubblicare le correzioni nel repository remoto.

### Modifiche effettuate
- `editor/src/fields/adapters/RepeaterField.jsx`: aggiornamenti asincroni delle mappe applicati alla riga corrente, conservando modifiche concorrenti e riordinamenti e ignorando le righe rimosse.
- `includes/conditions.php`: condizioni numeriche coerenti fra PHP ed editor per valori assenti, nulli e vuoti.
- `editor/src/index.js`, `editor/src/fields/adapters/MapField.jsx`: CSS delle mappe incluso nell'asset principale disponibile nell'iframe; JavaScript delle mappe mantenuto lazy.
- `editor/src/fields/types/TabPanels.jsx`: InnerBlocks mantenuto montato anche nelle tab inattive, per inizializzare il template senza aprire la tab.
- `includes/api.php`: preview tramite pipeline nativa di rendering, con applicazione dei filtri finali e conservazione del markup richtext consentito nel contesto ereditato.
- `editor/src/fields/types/ToolbarSelect.jsx`: select con `postType` nella toolbar collegato alla ricerca dei post esistente.
- `editor/src/fields/adapters/RepeaterField.test.jsx`, `editor/src/fields/adapters/MapField.test.jsx`, `editor/src/fields/types/TabPanels.test.jsx`, `editor/src/fields/types/ToolbarSelect.test.jsx`, `editor/src/engine/conditions.test.js`, `tests/php/values.php`, `tests/php/registration.php`: regressioni sui comportamenti corretti e sul contratto delle condizioni JavaScript.

### Note
Superati 110 test JavaScript in 30 suite e 46 test PHP su ciascuna versione 8.1.31 e 8.4.0. Sintassi dei 23 file PHP verificata su entrambe le versioni; lint JavaScript/SCSS e build completati. Rigenerati 11 asset; verificata la presenza del CSS Leaflet e MapCanvas in `index.css` e `index-rtl.css`, unici CSS della build. Webpack segnala soltanto il consueto avviso informativo sulla dimensione dell'entrypoint.

---

## 2026-09-25 — Non rilasciato: Autorizzazioni della preview REST

### Richiesta
Correggere i rilievi verificati della review della suite Corsivo, preservando le modifiche preesistenti e i contratti intenzionali.

### Modifiche effettuate
- `includes/api.php`: preview limitata a utenti che possono modificare contenuti, post type ammessi e oggetti leggibili.
- `tests/php/preview-permissions.php`: regressioni su clienti WooCommerce, coupon e permessi sul singolo oggetto.

### Note
Regressioni isolate superate su PHP 8.1 e 8.4. API pubbliche e canale di aggiornamento privato conservati; preparazione WordPress.org fuori da questa correzione.

---


## 2026-09-05 — In sviluppo

- Rafforzati i contratti dei valori approvati dopo l'audit: normalizzazione prima della validazione, controlli coerenti tra salvataggio e REST, autorizzazione `edit_post_meta` per chiave e compatibilità con salvataggi programmatici senza utente.
- Applicati ricorsivamente i default alle righe repeater nuove ed esistenti, mantenendo valori espliciti, chiavi sconosciute e identità delle righe; i campi numerici conservano il tipo durante le modifiche.
- Aggiunti `parent`, `ancestor`, `usesContext` e `providesContext` alla dichiarazione PHP, usando le API native Gutenberg. I custom field ricevono il contesto ereditato.
- Aggiunta diagnostica dello schema con `WP_DEBUG`, nome del blocco e percorso del campo, compatibile con estensioni e tipi personalizzati.
- Allineati schema e contesto fra frontend, Read API e anteprima. Mantenuti callback espliciti, file, funzione inferita a render-time e fallback InnerBlocks, senza obbligo di renderer nel tema.
- Spostata la validazione dei figli sul documento e mantenuta l'inizializzazione InnerBlocks in anteprima e nei contenitori chiusi.
- Ridotti i render dei campi indipendenti e le richieste di anteprima; conservato l'ultimo HTML durante l'aggiornamento e ignorate le risposte obsolete.
- Separati gli ID DOM dai nomi dei campi e corrette le creazioni asincrone concorrenti delle tassonomie.
- Sostituito l'autocomplete Nominatim pubblico con ricerca esplicita, cache e coda condivisa nella pagina; resi configurabili gli endpoint di ricerca e reverse.
- Corretti i selettori CSS della preview con radici multiple, stringhe quotate e commenti. Aggiornata la documentazione e le traduzioni italiane.

### Verifiche

- 87 test JavaScript in 27 suite; 38 contratti PHP su ciascuna versione 8.1 e 8.4. I test nativi usano parser, registry, rendering e contesto reali del checkout WordPress, con persistenza isolata in memoria.
- Lint JavaScript/SCSS e lint dei 22 file PHP superati; bundle di distribuzione rigenerato correttamente.
- Le verifiche non avviano il sito e non modificano il database.

---

## 2026-08-29 — Versione 1.1.0

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
- Caricati in chunk asincroni i field pesanti e il CSS Leaflet, mantenendo invariati registry, schema e formati salvati.
- Sostituito il caricamento completo delle tassonomie con ricerca REST paginata, percorsi gerarchici e idratazione a batch delle selezioni correnti.
- Mantenute esatte le chiavi `saveInMeta` mixed-case in salvataggio, lettura e scrittura REST.
- Isolate le eccezioni di render dei field lazy con fallback locale e action diagnostica `defb.fieldRenderError`.
- Aggiunta CI push/PR su PHP 8.1/8.4 e Node 20 con lint, test, build verificata e pacchetto installabile.

### Verifiche

- 46 test JavaScript, 6 contratti PHP/REST e 135 test dei package completati; lint JavaScript/SCSS, build, lint PHP, package dry-run e runtime audit verdi.
- I warning sulla dimensione dei bundle Define Blocks e showcase sono non bloccanti.
- Completato lo smoke test Gutenberg autenticato su un'installazione reale mantenendo invariato il registry dei blocchi.

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
