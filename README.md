# Subbuteo Club Brescia · Oltre la cortina di ferro

App per le conferme al torneo dedicato alle squadre dell'Est Europa anni Ottanta. Grafica da manifesto sportivo: carta, rosso mattone, verde scuro, illustrazione SVG originale.

Sito pubblico: https://oltre-la-cortina-di-ferro.vercel.app/

## Omini e divise

Scrivendo una squadra durante l'assegnazione appare un omino Subbuteo SVG, aggiornato in tempo reale. Il catalogo iniziale in Supabase contiene Spartak Mosca 1987/88 e Dynamo Dresda 1988/89, riconosciute anche tramite alias (ad esempio Dinamo Dresda). Le fonti delle maglie sono collegate nell'editor. Si tratta di ricostruzioni stilizzate: pantaloncini, calzettoni e dettagli possono essere corretti dall'utente.

Il catalogo documentato comprende anche Ferencváros 1986/87, Dinamo Kiev 1985/86 e Hansa Rostock 1989/90. Le vecchie divise neutre di queste squadre sono state aggiornate nel database, mantenendo nomi e conferme.

Per le altre squadre l'editor avvia una ricerca online dopo una breve pausa nella digitazione, tramite la funzione Vercel `api/kit-search.js`. Cerca pagine stagionali su Wikipedia in italiano e inglese, ricava i colori leggibili e collega la fonte. Non usa maglie attuali come se fossero anni Ottanta e non garantisce di trovare tutte le squadre o riprodurre motivi complessi: se i dati non sono utilizzabili, mostra la mancata corrispondenza e richiede una personalizzazione. Il salvataggio rimane disabilitato finché la divisa non è trovata o scelta manualmente. Non servono nuove chiavi API o credenziali private nella funzione.

Colori di maglia, dettagli, pantaloncini e calzettoni sono modificabili; motivi disponibili: tinta unita, strisce verticali/orizzontali, fascia sul petto o diagonale. Stagione e variante si salvano con la conferma. Il catalogo è pubblico in lettura e protetto dalle modifiche anonime; le divise dei giocatori seguono il modello pubblico delle conferme. Per provare le ricerche online in locale serve il runtime Vercel (il solo server Vite non serve la cartella API).

## Funzionamento

I 12 candidati, nell'ordine del ranking: Flavio, Rudy, Andrea, Bono, Grifo, Flanik, Begnozzi, Salvi, Carmelo, Omar, Leo, Giulio. Assegnare una squadra conferma un giocatore; si possono modificare le squadre, lasciare una conferma aperta o segnare una rinuncia. Giulio parte come indeciso. Squadre a nome libero, uniche fra i giocatori.

Con 11 confermati i primi 5 partecipanti nel ranking vanno in A e gli altri 6 in B. Con 12 si passa a 6+6. Le proiezioni rimangono provvisorie finché ci sono risposte aperte. Il calendario verrà dopo la validazione del gruppo.

**Accesso senza login**, richiesto dal club: chiunque raggiunga il sito può vedere e modificare le conferme di tutti. Il link non è una password. Non ci sono account da creare. Il database protegge nomi, ranking, registro delle modifiche e struttura delle tabelle. L'audit delle modifiche anonime conserva prima/dopo e data, ma non identifica la persona.

## Sviluppo

Node.js 22 o successivo:

```sh
npm ci
npm run dev
npm test
npm run build
```

Senza le variabili Supabase l'app parte in modalità demo e salva solo nel browser. I dati demo non si trasferiscono nel database.

## Supabase

Creare `.env.local` da `.env.example` e configurare `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Usare solo la chiave pubblica, mai service_role o secret key. La chiave pubblica può comparire nel bundle frontend; RLS e privilegi SQL limitano le operazioni.

Per creare e aggiornare lo schema, salvare la URI PostgreSQL del Session pooler completa di password in `.env.database.local`:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@HOST:5432/postgres"
```

Il certificato pubblico del progetto è in `supabase/ca.crt`. Le credenziali sono escluse da Git. Non caricare mai `.env.local` o `.env.database.local` nel repository.

```sh
npm run db:check
npm run db:migrate
node --env-file=.env.database.local scripts/verify-database.js
```

Il runner esegue in transazione le migrazioni ordinate in `supabase/migrations`, registra checksum/versioni e impedisce applicazioni concorrenti. Non mescolare questo runner con Supabase CLI o eseguire il vecchio `schema.sql`: quest'ultimo documenta solo lo schema iniziale con login. Il database configurato ha già ricevuto entrambe le migrazioni, inclusa quella per l'accesso pubblico.

## GitHub e Vercel

Caricare questa cartella in un repository GitHub dedicato. `.gitignore` esclude credenziali, dipendenze e build. Il certificato CA è pubblico e può essere versionato.

Importare il repository in Vercel:

- Framework: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.
- Environment variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, copiati dal file locale.

Rieseguire il deploy dopo modifiche delle variabili. Le migrazioni si applicano con `npm run db:migrate` dal contesto di rilascio con accesso al database; il build frontend non contiene credenziali PostgreSQL e non applica migrazioni. Il repository `FlavioFirmo69/oltre-la-cortina-di-ferro` è collegato a Vercel; il branch di produzione è `mslearn-tailspin-spacegame-web`, nome ereditato dall'impostazione iniziale dell'account GitHub.

## Verifiche e passo successivo

I test locali coprono ranking, formati, squadre, calendario e classifica. La verifica del DB pubblico controlla letture e conferme anonime, revoca, audit, blocco scritture dirette e colonne private, duplicati e conflitti di versione; tutte le modifiche di prova sono annullate con rollback.

Calendario, risultati, classifica e cambio stagione non sono ancora esposti. `src/league.js` contiene funzioni testate per il passo successivo. Formula concordata: andata e ritorno, 3 punti vittoria, 1 pareggio, 2 retrocessioni e 2 promozioni. Restano da concordare i criteri di parità.

## Archivio storico e scrittura manuale

`/storia-dei-campionati` legge gli articoli pubblicati da `historical_articles`. Il pulsante **Scrivi un articolo** apre titolo, paese, stagione, sommario, testo e sezioni facoltative per commento, regole, classifica e fonti. L'anteprima precede la pubblicazione; la bozza resta nel localStorage del browser. Il sito mantiene la modalità pubblica senza login concordata: chi ha il link può pubblicare. Il testo viene reso come testo semplice con escaping HTML, i link devono usare HTTPS. Il DB consente l'inserimento solo attraverso la funzione validata `publish_historical_article`, senza scritture dirette sulle tabelle.

Il primo articolo, Germania Est 1987/88, è stato preparato e verificato sulle classifiche RSSSF. Nessun modello AI è collegato, nessun credito è stato attivato e nessun articolo viene generato in autonomia. Le funzioni del precedente prototipo automatico sono revocate dalla migrazione manuale.

`vercel.json` programma esclusivamente una lettura giornaliera alle 07:17 UTC (`/api/editorial-cron`). Configurare `CRON_SECRET` come Secret di produzione, senza prefisso VITE_. Il controllo usa il solo accesso pubblico in lettura, non pubblica contenuti e non usa AI. L'attività giornaliera aiuta contro l'inattività Supabase Free ma non garantisce che il progetto non venga sospeso. Vercel Hobby può eseguire il controllo nell'ora pianificata anziché al minuto esatto.

Verifiche: `npm test`, `npm run build`, `node --env-file=.env.database.local scripts/verify-editorial.js`. Quest'ultimo verifica la pubblicazione con rollback, la disabilitazione della generazione e i permessi anonimi. Per ricreare il primo articolo usare `scripts/seed-history.js` solo in un ambiente iniziale. Le migrazioni 20261120000100–00300 sono state applicate al database del club.
