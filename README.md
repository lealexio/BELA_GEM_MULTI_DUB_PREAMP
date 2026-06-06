# Bela Gem Multi — Dub Preamp

Préampli numérique de style reggae/dub implémenté sur **Bela Gem Multi** en C++.  
Traitement audio temps réel à ultra-basse latence, piloté par des potentiomètres physiques multiplexés et des switches via GPIO I2C.

---

## Architecture

```
                 ┌──────────────────────────────────────────────┐
IN0 ─────────►  │ ChannelStrip 1                               │
                 │  gain → NoiseGate → EQ 3 bandes             │ ──► FX SEND (OUT2)
IN1 ─────────►  │ ChannelStrip 2                               │
                 │  gain → NoiseGate → EQ 3 bandes             │
                 └────────────────────┬─────────────────────────┘
                                      │ dry mix
                 ┌────────────────────▼─────────────────────────┐
FX RETURN (IN2) ►│ MasterFx                                     │
                 │  NoiseGate (FX return) + KillSwitch 4 bandes │
                 └────────────────────┬─────────────────────────┘
                                      │
                               OUT0 + OUT1 (mono)
```

### Fichiers source

| Fichier | Rôle |
|---|---|
| `render.cpp` | Point d'entrée Bela : setup / render / cleanup — orchestre tous les modules |
| `HardwareManager.h/cpp` | Scan MUX (CD74HC4067) + lecture switches (MCP23017 via I2C) |
| `ChannelStrip.h/cpp` | Tranche de canal : gain → gate → EQ 3 bandes → FX send |
| `MasterFx.h/cpp` | Bus master : KillSwitch 4 bandes + gate de retour FX |
| `KillSwitch.h/cpp` | Crossover parallèle 4 bandes avec fade sans clics |
| `NoiseGate.h/cpp` | Gate professionnel : peak follower + state machine ATTACK/HOLD/RELEASE |
| `Biquad.h/cpp` | Filtre biquad IIR 2nd ordre (low/high shelf, peaking EQ, LP/HP) |
| `HardwareConfig.h` | Mapping hardware : PotRef, SwitchRef, routing audio, config I2C/MUX |
| `SoftwareConfig.h` | Paramètres DSP : fréquences EQ, kills, gate, debug, clipping |

---

## Contrôles physiques

### MUX 0 — Channel Strip 1 (IN0)

| Pot | Constante | Fonction |
|---|---|---|
| C01 | `CH1_INPUT_GAIN` | Gain d'entrée (0.0 = silence, 1.0 = unité) |
| C14 | `CH1_EQ_LOW` | Low shelf @ `kEqLowFreq` Hz (centre = 0 dB) |
| C00 | `CH1_EQ_MID` | Mid peak  @ `kEqMidFreq` Hz (centre = 0 dB) |
| C15 | `CH1_EQ_HIGH` | High shelf @ `kEqHighFreq` Hz (centre = 0 dB) |
| C13 | `CH1_FX_SEND` | Niveau de départ vers l'effet (post-fader) |

### MUX 0 — Channel Strip 2 (IN1)

| Pot | Constante | Fonction |
|---|---|---|
| C06 | `CH2_INPUT_GAIN` | Gain d'entrée |
| C09 | `CH2_EQ_LOW` | Low shelf |
| C07 | `CH2_EQ_MID` | Mid peak |
| C08 | `CH2_EQ_HIGH` | High shelf |
| C10 | `CH2_FX_SEND` | Niveau de départ FX |

> Les potentiomètres EQ ont une **aimantation centrale** (snap à 0.5 → 0 dB).  
> Rayon configurable via `kSnapRadiusCenter` dans `SoftwareConfig.h`.

### MCP23017 — Switches kills (port A)

| Pin | Constante | Bande killed |
|---|---|---|
| PA0 | `KILL_KICK` | KICK  80 – 200 Hz |
| PA1 | `KILL_SUB` | SUB   20 – 80 Hz |
| PA2 | `KILL_MID` | MID   200 – 1200 Hz |
| PA3 | `KILL_TOP` | TOP   1200 Hz+ |

> Chaque switch a un flag `reversed` dans `HardwareConfig.h` pour inverser la logique.

---

## Câblage hardware

### Multiplexeurs CD74HC4067

```
Bela D0 → S0 (bit d'adresse 0)    Bela A0 → signal MUX 0
Bela D1 → S1 (bit d'adresse 1)    Bela A1 → signal MUX 1
Bela D2 → S2 (bit d'adresse 2)    Bela A2 → signal MUX 2
Bela D3 → S3 (bit d'adresse 3)    Bela A3 → signal MUX 3 (réservé)
```

### MCP23017 (switches)

```
Bela SDA → SDA    Bela SCL → SCL
GND → GND         3.3V → VCC
A0 = A1 = A2 = GND → adresse I2C 0x20
```

### Routing audio

```
Bela IN0  → Channel Strip 1 (source)
Bela IN1  → Channel Strip 2 (source)
Bela IN2  → FX Return (retour effet externe)
Bela OUT0 → Master L (sortie principale)
Bela OUT1 → Master R (sortie principale, même signal — mono)
Bela OUT2 → FX Send  (somme des départs des deux channels)
```

### Niveaux audio

- Entrée nominale : **±316 mV** (niveau ligne –10 dBV)
- Entrée maximum avant écrêtage ADC : **±1 V**
- Recommandation source : maintenir à 60–70 % du volume maximum

---

## Configuration

### `HardwareConfig.h` — tout ce qui est physique

```cpp
// Nombre de MUX branchés physiquement (≤ kNumMux)
constexpr int kActiveMux = 3;

// Calibration des potentiomètres
constexpr float kPotMax = 0.997f;  // valeur observée au maximum
constexpr float kPotMin = 0.005f;  // valeur observée à zéro

// Ajouter un MUX → incrémenter kActiveMux, décommenter les PotRef MUX1 en bas du fichier
```

### `SoftwareConfig.h` — tout ce qui est comportement DSP

```cpp
// Noise gate (par channel et retour FX)
constexpr float kGateThreshold = 0.005f; // seuil d'ouverture (≈ -46 dBFS)
constexpr float kGateHoldMs    = 100.f;  // temps avant fermeture après perte de signal

// Kills
constexpr float kKillRampMs      = 30.f; // durée du fondu activation/désactivation (ms)
constexpr int   kKillFilterStages = 2;   // pentes : 1 → 12 dB/oct, 2 → 24 dB/oct

// Fréquences de crossover des kills
constexpr float kKillFc0 =   80.f;  // SUB  / KICK
constexpr float kKillFc1 =  200.f;  // KICK / MID
constexpr float kKillFc2 = 1200.f;  // MID  / TOP

// EQ channel
constexpr float kEqLowFreq    = 250.f;
constexpr float kEqMidFreq    = 1000.f;
constexpr float kEqHighFreq   = 4000.f;
constexpr float kEqGainRangeDb = 6.f;  // ±6 dB de plage EQ

// Debug
constexpr bool kDebug = true;
```

### Ajouter un potentiomètre

1. Brancher sur une entrée Sx du MUX
2. Déclarer dans `HardwareConfig.h` :
```cpp
constexpr PotRef MON_POTARD = {0, 5};         // MUX 0, canal 5
constexpr PotRef MON_POTARD_INV = {0, 5, true}; // idem, sens inversé
```
3. Utiliser dans `render.cpp` :
```cpp
gHardwareManager.getPotValue(MON_POTARD)          // [0.0–1.0]
gHardwareManager.getCenteredPotValue(MON_POTARD)  // avec snap central à 0.5
```

### Ajouter un switch

1. Brancher sur un pin PA du MCP23017
2. Déclarer dans `HardwareConfig.h` :
```cpp
constexpr SwitchRef MON_SWITCH = {4};         // PA4, actif LOW
constexpr SwitchRef MON_SWITCH_INV = {4, true}; // PA4, actif HIGH
```
3. Utiliser dans `render.cpp` :
```cpp
gHardwareManager.getSwitchState(MON_SWITCH)   // true = switch actif
```

---

## Debug

Activer/désactiver les logs dans `SoftwareConfig.h` :

```cpp
constexpr bool kDebug = true;  // false = aucun log pot/switch
```

Avec `kDebug = true`, chaque potard qui bouge au-delà de `kDebugPotMinMove` (0.01) affiche :
```
[POT] CH1_INPUT_GAIN   MUX0/C01  →  0.742
[POT] CH2_EQ_MID       MUX0/C07  →  0.501
```

Les changements d'état des switches s'affichent immédiatement :
```
[SW]  PA1  →  CLOSED
[SW]  PA1  →  OPEN
```

Exclure un potard bruité du log (flottant, en test…) dans `HardwareConfig.h` :
```cpp
constexpr PotRef kIgnoredPots[] = {
    {1, 2},  // MUX1/C02 — sous investigation
};
```

La détection de clipping est toujours active, indépendamment de `kDebug` :
```
WARNING Canal 0 clipping
```

---

## Roadmap

- [x] Phase 1  — Lecture multiplexeurs via `HardwareManager` (MUX scan RT)
- [x] Phase 2  — Gain d'entrée + EQ 3 bandes via `ChannelStrip`
- [x] Phase 3  — Noise gate par channel (`NoiseGate`)
- [x] Phase 4  — Lecture switches MCP23017 via I2C (`AuxiliaryTask`)
- [x] Phase 5  — Kill switches 4 bandes sans clics (`KillSwitch`, crossover parallèle)
- [x] Phase 6  — FX Send / Return avec gate de retour (`MasterFx`)
- [x] Phase 7  — Support multi-MUX, multi-channel, config centralisée
- [ ] Phase 8  — Dub Siren (oscillateur LFO + pitch drop + gate)
- [ ] Phase 9  — EQ paramétrique 4 bandes
- [ ] Phase 10 — Filtre LPF et HPF avec résonance
- [ ] Phase 11 — Gain par bande
- [ ] Phase 12 — Gain Master
