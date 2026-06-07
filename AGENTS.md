# AGENTS.md — Contexte de travail pour agent IA

Ce fichier est la source de vérité pour tout agent IA travaillant sur ce projet.
Lire ce fichier en entier avant de toucher au code.

---

## Projet

**Nom :** Dub Preamp BELA GEM MULTI
**Plateforme :** Bela Gem Multi (ARM Linux, audio temps réel, 44.1 kHz)  
**Langage :** C++11  
**Compilateur cible :** cross-compilation ARM — le linter local (Windows/Clang) peut signaler de faux positifs sur `<cmath>`, `M_PI`, etc. Ignorer ces warnings.

---

## Structure des fichiers

```
render.cpp          Point d'entrée Bela (setup / render / cleanup)
HardwareManager.h/cpp   Scan MUX + lecture MCP23017 I2C
ChannelStrip.h/cpp  Tranche de canal : gain → gate → EQ → FX send
MasterFx.h/cpp      Bus master : orchestre KillSwitch + gate retour FX
KillSwitch.h/cpp    Kill 4 bandes sans clics (crossover parallèle LP/HP)
NoiseGate.h/cpp     Gate professionnel (peak follower + state machine)
Biquad.h/cpp        Filtre biquad IIR 2nd ordre (shelf, peak, LP, HP)
HardwareConfig.h    Constantes PHYSIQUES : mapping pots/switches, routing I/O, I2C
SoftwareConfig.h    Constantes DSP/COMPORTEMENT : EQ, gate, kills, debug
```

**Règle de séparation des configs :**
- Tout ce qui dépend du câblage physique → `HardwareConfig.h`
- Tout ce qui dépend du comportement DSP ou des préférences sonores → `SoftwareConfig.h`
- Aucune valeur magique dans le code source (`.cpp` / `.h`)

---

## Threading model (CRITIQUE)

| Thread | Priorité | Ce qui s'y exécute |
|---|---|---|
| RT `render()` | 95+ | `scanStep()`, `getPotValue()`, `getSwitchState()`, tout le DSP |
| `AuxiliaryTask` | 50 | `readMcp23017()` uniquement (I2C bloquant) |
| Système | std | IDE Web Bela, oscilloscope, logs noyau |

**Interdictions absolues dans `render()` :**
- Appels I2C ou tout I/O bloquant
- `malloc` / `new` / `delete`
- `printf` standard (utiliser `rt_printf`)
- `std::vector`, `std::string`, ou tout conteneur à allocation dynamique

---

## Chaîne de signal complète

```
IN0 ──► ChannelStrip 1 ──► dry1 ──┐
                   └─────────────────► fxSend (OUT2 → effet externe)
IN1 ──► ChannelStrip 2 ──► dry2 ──┤
                                   │
IN2 (retour FX) ──► NoiseGate ────►┤
                   (fxReturnGate_) │
                                   ▼
                          dry1 + dry2 + fxReturn
                                   │
                          KillSwitch (4 bandes)
                                   │
                           OUT0 + OUT1 (mono)
```

**Chaque ChannelStrip :**
```
IN → × inputGain_ → NoiseGate → EQ (low shelf / mid peak / high shelf) → dry OUT
                                         └──────── × fxSendLevel_ ──► fxOut()
```

---

## Routing audio (Bela Gem Multi — 10 I/O)

| Signal | I/O Bela | Constante dans HardwareConfig.h |
|---|---|---|
| Source canal 1 | IN0 | `CH1_CONFIG.audioIns[0]` |
| Source canal 2 | IN1 | `CH2_CONFIG.audioIns[0]` |
| Retour FX | IN2 | `FX1_RETURN_IN` |
| Sortie master L | OUT0 | `MASTER_OUT_L` |
| Sortie master R | OUT1 | `MASTER_OUT_R` |
| Départ FX | OUT2 | `FX1_SEND_OUT` |

---

## Mapping hardware actuel

### Potentiomètres (MUX 0, 1 et 2 connectés — `kActiveMux = 3`)

| Constante | MUX | Canal | Fonction |
|---|---|---|---|
| `CH1_INPUT_GAIN` | 0 | C01 | Gain entrée canal 1 |
| `CH1_EQ_MID` | 0 | C00 | Mid peak canal 1 |
| `CH1_EQ_LOW` | 0 | C14 | Low shelf canal 1 |
| `CH1_EQ_HIGH` | 0 | C15 | High shelf canal 1 |
| `CH1_FX_SEND` | 0 | C13 | Départ FX canal 1 |
| `CH2_INPUT_GAIN` | 0 | C06 | Gain entrée canal 2 |
| `CH2_EQ_MID` | 0 | C07 | Mid peak canal 2 |
| `CH2_EQ_HIGH` | 0 | C08 | High shelf canal 2 |
| `CH2_EQ_LOW` | 0 | C09 | Low shelf canal 2 |
| `CH2_FX_SEND` | 0 | C10 | Départ FX canal 2 |

> MUX1/C02 et MUX2/C02 sont dans `kIgnoredPots` (sous investigation matérielle).

### Switches (MCP23017 port A, adresse I2C 0x20)

| Constante | Pin | Bande | `reversed` |
|---|---|---|---|
| `KILL_KICK` | PA0 | 80–200 Hz | true |
| `KILL_SUB` | PA1 | 20–80 Hz | true |
| `KILL_MID` | PA2 | 200–1200 Hz | true |
| `KILL_TOP` | PA3 | 1200 Hz+ | false |

---

## Paramètres DSP clés (SoftwareConfig.h)

| Constante | Valeur | Rôle |
|---|---|---|
| `kGateThreshold` | 0.005 | Seuil d'ouverture du gate (≈ -46 dBFS) |
| `kGateAttackMs` | 2 ms | Vitesse d'ouverture du gate |
| `kGateHoldMs` | 100 ms | Temps de maintien avant fermeture |
| `kGateReleaseMs` | 150 ms | Vitesse de fermeture |
| `kKillRampMs` | 30 ms | Durée fondu activation/désactivation kill |
| `kKillFilterStages` | 2 | Pentes : 2 × 12 = 24 dB/oct par bande |
| `kKillFc0` | 80 Hz | Frontière SUB/KICK |
| `kKillFc1` | 200 Hz | Frontière KICK/MID |
| `kKillFc2` | 1200 Hz | Frontière MID/TOP |
| `kEqLowFreq` | 250 Hz | Fréquence low shelf EQ |
| `kEqMidFreq` | 1000 Hz | Fréquence mid peak EQ |
| `kEqHighFreq` | 4000 Hz | Fréquence high shelf EQ |
| `kEqGainRangeDb` | 6 dB | Plage EQ (pot 0.5 = 0 dB, pot 1.0 = +6 dB) |
| `kDebug` | true | Active le log des pots/switches dans render() |

---

## Conventions de code à respecter

1. **Documentation** : chaque méthode publique a un doc-comment court **en anglais**.
2. **Un objet = une mission.** Si une classe grossit, extraire dans un objet dédié (pattern appliqué : `NoiseGate` sorti de `ChannelStrip`, `KillSwitch` sorti de `MasterFx`).
3. **Pas de copier-coller.** Factoriser dans des objets ou des fonctions helper.
4. **Flexibilité** : tout paramètre numérique doit être une constante nommée dans `HardwareConfig.h` ou `SoftwareConfig.h`.
5. **Nommage** : membres privés avec underscore final (`gain_`), constantes avec préfixe `k` (`kGateThreshold`), configs hardware en MAJUSCULES (`MASTER_OUT_L`, `CH1_INPUT_GAIN`).

---

## Décisions d'architecture importantes (ne pas réverter)

### Scan MUX dans render() — pas dans AuxiliaryTask
Le scan des MUX utilise `analogRead()` et `digitalWrite()` qui requièrent un `BelaContext*` valide. Ces fonctions ne sont RT-safe que dans `render()`. Toute tentative de les appeler depuis une AuxTask produit des valeurs aléatoires.

### Kill switches : crossover parallèle + double ramp
Le KillSwitch utilise un crossover **parallèle** (4 extractions indépendantes du même signal, pas sériel) pour éviter le bleed entre bandes. La transition bypass↔crossover utilise un `crossoverMix_` (ramp par sample) en plus du `bandGain_` pour éliminer les clics à l'activation du premier kill.

### NoiseGate : un seul seuil (pas d'hystérésis)
L'hystérésis (deux seuils open/close) a été implémentée puis révoquée car elle coupait les signaux faibles. Le comportement actuel (seuil unique + hold long) est validé et stable.

### EQ bypass automatique
Dans `ChannelStrip::process()`, si `lastLow_ == lastMid_ == lastHigh_ == 0.f`, les filtres EQ sont contournés entièrement (aucun filtre dans le chemin de signal). Cela évite toute coloration de phase à 0 dB.
