# Import del catalogo da CSV

Il coordinatore carica un file CSV dalla pagina **Catalogo**, bottone "Importa CSV".
Il file viene prima controllato e mostrato in riepilogo: niente viene scritto finché non si
conferma.

## Formato

Prima riga di intestazione, poi una riga per prodotto. Separatore `;` oppure `,`:
viene riconosciuto da solo, quindi va bene il CSV che esce da Excel in italiano.
Le intestazioni non distinguono maiuscole, accenti o spazi.

| Colonna | Obbligatoria | Note |
|---|---|---|
| `Nome` | sì | nome del prodotto, massimo 255 caratteri |
| `Produttore` | sì | deve corrispondere al nome di un produttore **attivo** del GAS |
| `Categoria` | no | se indicata, deve essere una categoria già esistente nel GAS |
| `Unità` | sì | simbolo o nome dell'unità: `kg`, `g`, `L`, `pz`, `bt`, `conf`, `sac`, `lat`, `vas` |
| `Prezzo` | sì | virgola o punto come separatore decimale |
| `Stock` | no | lasciare vuoto se la disponibilità è illimitata |
| `Min ordine` | no | quantità minima ordinabile; se omessa vale 1 |
| `Attivo` | no | `si`/`no`, `1`/`0`, `true`/`false`; se omessa il prodotto è attivo |

Sono accettati anche i nomi inglesi delle colonne (`name`, `producer`, `category`, `unit`,
`price`, `stock`, `moq`, `active`).

Esempio:
```csv
Nome;Produttore;Categoria;Unità;Prezzo;Stock;Min ordine;Attivo
Arance Navel;Azienda Agricola Sole;Ortofrutta;kg;2,80;;1;si
Finocchi Bio;Azienda Agricola Sole;Ortofrutta;kg;3,20;40;2;si
Pane integrale;Il Forno Antico;Forno;pz;4,00;;1;
```

## Come si comporta

- **Prodotti già presenti**: un prodotto con lo stesso nome dello stesso produttore viene
  **aggiornato**, non duplicato. Reimportare un listino aggiornato funziona.
- **Prezzi protetti**: se un prodotto compare in ordini in corso (bozze o confermati), il
  prezzo **non** viene modificato, perché cambierebbe il totale di ordini già fatti. Tutto
  il resto viene aggiornato. Il riepilogo finale conta queste righe come `priceKept`.
- **Tutto o niente**: l'importazione avviene in una transazione. Se qualcosa va storto a
  metà, non viene salvata nessuna riga.
- **Validazioni dei listini azzerate**: dopo un import, i produttori del GAS devono
  validare di nuovo il listino per il ciclo in corso, come quando modificano i prodotti da
  soli. Serve a non far comparire ai soci prezzi che il produttore non ha confermato.
- **Limite**: 2000 righe per file.

## Errori

Il riepilogo elenca le righe scartate con il numero di riga e il motivo, per esempio
`produttore "Caseificio Rossi" non presente fra quelli attivi del GAS` oppure
`unità "barattolo" non riconosciuta`. Le righe valide si possono importare comunque: quelle
scartate si correggono nel file e si ricarica.

Produttori e categorie **non** vengono creati automaticamente: un nome scritto male
creerebbe un'anagrafica sbagliata, difficile da notare. Vanno creati prima dalle rispettive
pagine.
