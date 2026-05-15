# Bela Gem Multi — Dub Preamp

Préampli numérique style implémenté sur **Bela Gem Multi** en C++.  
Traitement audio temps réel à ultra-basse latence, contrôle via potentiomètres physiques multiplexés.

---

## Architecture

```
Audio IN (L+R) → mix mono → ChannelStrip (gain + EQ 3 bandes) → Audio OUT (L+R)
                                    ↑
                         HardwareManager (MUX scan)
                                    ↑
                         CD74HC4067 × 1-4 (64 potentiomètres max)
```

### Modules

| Fichier | Rôle |
|---|---|
| `render.cpp` | Point d'entrée Bela : setup / render / cleanup |
| `HardwareManager.h/cpp` | Scan des multiplexeurs MUX via D0–D3 + A0–A3 |
| `ChannelStrip.h/cpp` | Gain d'entrée + égaliseur 3 bandes (filtres Biquad) |
| `HardwareConfig.h` | Mapping nommé de tous les potentiomètres (`PotRef`) |

---

## Contrôles physiques (MUX 0 — actuel)

| Potentiomètre | Constante | Fonction |
|---|---|---|
| C00 | `EQ_LOW_GAIN` | Low shelf @ 250 Hz (-6 à +6 dB) |
| C01 | `INPUT_GAIN` | Gain d'entrée (0.0 = silence, 1.0 = unité) |
| C14 | `EQ_HIGH_GAIN` | High shelf @ 4 kHz (-6 à +6 dB) |
| C15 | `EQ_MID_GAIN` | Mid peak @ 1 kHz, Q=1.4 (-6 à +6 dB) |

> Les potentiomètres EQ possèdent une **aimantation centrale** (snap to 0 dB) et des **aimantations aux extrémités** (snap to ±6 dB).

---

## Câblage hardware

### Multiplexeur CD74HC4067
```
D0 → pin d'adresse bit 0    A0 → sortie signal MUX 0
D1 → pin d'adresse bit 1    A1 → sortie signal MUX 1 (futur)
D2 → pin d'adresse bit 2    A2 → sortie signal MUX 2 (futur)
D3 → pin d'adresse bit 3    A3 → sortie signal MUX 3 (futur)
```

### Niveaux audio
- Entrée nominale : **±316 mV** (niveau ligne -10 dBV)
- Entrée maximum avant écrêtage ADC : **±1 V**
- Maintenir la source à **60–70% de volume maximum**

---

## Configuration

### Ajouter un potentiomètre
1. Brancher sur une entrée Sx du MUX
2. Ajouter une constante dans `HardwareConfig.h` :
```cpp
constexpr PotRef MON_POTARD = {0, 5};  // MUX 0, canal 5
```
3. Utiliser dans le code :
```cpp
gHardwareManager.getPotValue(MON_POTARD)         // valeur brute [0.0–1.0]
gHardwareManager.getCenteredPotValue(MON_POTARD)  // avec snap central à 0.5
```

### Ajouter un 2ème multiplexeur
1. Brancher le MUX sur **A1**
2. Mettre `kActiveMux = 2` dans `HardwareManager.h`
3. Décommenter les lignes MUX 1 dans `HardwareConfig.h`

### Calibration des potentiomètres
Dans `HardwareManager.h` :
```cpp
const float kPotMax          = 0.997f;  // valeur observée au maximum
const float kPotMin          = 0.005f;  // valeur observée à zéro
const float kJitterThreshold = 0.002f;  // seuil anti-jitter ADC
const float kSnapRadiusCenter = 0.10f;  // rayon aimantation centre
```

---

## Debug

Mettre `DEBUG = true` dans `render.cpp` pour afficher les gains toutes les 0.5 s :
```
--- Channel Strip --------
INPUT_GAIN  : 0.823
EQ_LOW_GAIN : +0.00 dB
EQ_MID_GAIN : -2.40 dB
EQ_HIGH_GAIN: +3.60 dB
--------------------------
```

La détection de clip est toujours active (indépendante de `DEBUG`) :
```
WARNING Canal 0 clipping
```

---

## Roadmap (AGENTS.md)

- [x] Phase 1 — Lecture multiplexeurs via `HardwareManager`
- [x] Phase 2 — Gain d'entrée + EQ 3 bandes via `ChannelStrip`
- [ ] Phase 3 — Crossover 4 bandes (Sub / Bass / Mids / Tops)
- [ ] Phase 4 — FX Send avec filtrage pré-FX
- [ ] Phase 5 — Saturation / soft-clipping
- [ ] Phase 6 — Intégration des 64 contrôles + switches MCP23017 (kills etc)
