# math-exercise – Quarto Extension

Interaktive Mathematikaufgaben, die vollständig im Browser ausgewertet werden –  
kein Server, kein Python-Kernel, nur clientseitiges [Pyodide](https://pyodide.org) + [SymPy](https://www.sympy.org).

---

## Einbinden

```yaml
filters:
  - Erasmus-CTM/math-exercise
```

Kein `{pyodide}`-Block nötig – Pyodide und SymPy werden beim ersten Klick auf
**Überprüfen** automatisch geladen, sofern sie nicht schon durch die
`coatless-quarto/pyodide`-Extension verfügbar sind.

---

## Grundsyntax

````markdown
```{math-exercise}
#| label: meine-aufgabe
#| caption: Aufgabentitel
#| vars: x
Fragetext mit Eingabefeld: _[korrekte_antwort]
```
````

---

## Eingabefelder im Fragetext

| Marker | Breite | Element |
|--------|--------|---------|
| `_[antwort]` | schmal (~10 Zeichen) | `<input>` |
| `__[antwort]` | mittel (~20 Zeichen) | `<input>` |
| `___[antwort]` | breit, 2-zeilig | `<textarea>` |

Mehrere Felder in einer Aufgabe werden beim Klick auf **Überprüfen** gemeinsam geprüft.  
Die Antwort in `[...]` ist ein SymPy-Ausdruck, z. B. `pi * 9`, `x**2 + 2*x + 1`.

---

## Optionen (`#|`)

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|--------------|
| `label` | String | `math-exercise-N` | Eindeutige ID der Aufgabe |
| `caption` | String | — | Titel über der Aufgabe |
| `vars` | kommasepariert | — | SymPy-Variablen, z. B. `x, y, r` |
| `mode` | `equivalent` / `exact` | `equivalent` | Prüfmodus |
| `reject` | SymPy-Ausdruck | — | Diesen Ausdruck ablehnen (auch wenn korrekt) |
| `pool` | `true` / `false` | `false` | Aufgaben-Pool aktivieren |

---

## Prüfmodi

### `mode: equivalent` *(Standard)*

Akzeptiert **jede mathematisch gleichwertige** Darstellung.  
`pi*9`, `9*pi`, `3**2 * pi` sind alle korrekt für `[pi * 9]`.

### `mode: equivalent` + `reject: ausdruck`

Gleichwertige Terme werden akzeptiert – **außer** dem angegebenen Ausdruck.  
Sinnvoll für Vereinfachungsaufgaben: der Schüler darf nicht einfach das Original eintippen.

```yaml
#| mode: equivalent
#| reject: (x+1)**2
```

→ `(x+1)^2` und `(1+x)^2` werden abgelehnt, `x^2 + 2x + 1` wird akzeptiert.

### `mode: exact`

Akzeptiert **nur** die kanonische SymPy-Darstellung des Antwortausdrucks.  
Sinnvoll wenn genau eine bestimmte Form verlangt wird.

---

## Aufgaben-Pool

Mit `#| pool: true` und `---` als Trenner lassen sich **mehrere Varianten** definieren.  
Pro Seitenaufruf wird eine Variante zufällig gewählt und für die Session gespeichert.

````markdown
```{math-exercise}
#| label: kreis-pool
#| caption: Kreisfläche
#| pool: true

Berechne die Fläche eines Kreises mit r = 3 cm.
A = _[pi * 9] cm²

---

Berechne die Fläche eines Kreises mit r = 5 cm.
A = _[pi * 25] cm²

---

Berechne die Fläche eines Kreises mit r = 7 cm.
A = _[pi * 49] cm²
```
````

- Alle Varianten teilen dieselben Optionen (`vars`, `mode`, `reject`).
- Die gewählte Variante bleibt innerhalb der Browser-Session stabil (kein Wechsel bei Re-Render).
- Ein **↻-Button** oben rechts im Aufgabenfeld lädt eine neue (andere) Zufallsvariante.

---

## KI-Feedback

Jede Aufgabe enthält einen **Feedback**-Button. Beim ersten Klick erscheint ein
Konfigurationsdialog für den LLM-Zugang:

| Feld | Beispiel |
|------|---------|
| Base URL | `https://api.cerebras.ai/v1` |
| API Key | `csk-...` |
| Modell | `llama-3.3-70b` |

Die Zugangsdaten werden in `localStorage` gespeichert und stehen auf **allen Seiten
desselben Projekts** zur Verfügung – einmaliges Einrichten reicht.

**Progressiver Hinweis-Level:** Bei jedem weiteren Feedback-Klick zur gleichen Aufgabe
(auf derselben Seite) wird der Hinweis konkreter:

| Versuch | Verhalten |
|---------|-----------|
| 1. | Sanfter Denkanstoß, Lösung wird nicht verraten |
| 2. | Konkreter Hinweis auf den Lösungsansatz |
| 3.+ | Vollständiger Lösungsweg Schritt für Schritt |

Kompatibel mit jeder **OpenAI-kompatiblen API** (Cerebras, OpenAI, Groq, Ollama, …).

---

## Eingabe-Syntax für Schüler

Die klappbare **Eingabe-Hilfe** zeigt alle wichtigen Schreibweisen:

| Ausdruck | Eingabe |
|----------|---------|
| x² | `x^2` oder `x**2` |
| √x | `sqrt(x)` |
| ⁿ√x | `root(x, n)` |
| π | `pi` |
| e | `E` |
| sin(x) | `sin(x)` |
| ln(x) | `ln(x)` |
| \|x\| | `Abs(x)` |
| ∞ | `oo` |
| ∫f dx | `integrate(f, x)` |
| d/dx f | `diff(f, x)` |

Grundrechenzeichen: `+` `-` `*` `/`  
Potenz: `^` oder `**`  
Klammern: `(` `)`

---

## Zusammenspiel mit coatless-quarto/pyodide

Die Extension funktioniert **mit und ohne** `{pyodide}`-Block:

- **Mit Block:** Die coatless-Extension initialisiert Pyodide; math-exercise wartet
  auf diese Instanz und nutzt sie.
- **Ohne Block:** Pyodide und SymPy werden beim ersten Check selbst geladen
  (erster Klick dauert einige Sekunden länger).
