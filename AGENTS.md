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
render.cpp              Point d'entrée Bela (setup / render / cleanup)
HardwareManager.h/cpp   Scan MUX + lecture MCP23017 I2C
ChannelStrip.h/cpp      Tranche de canal : gain → gate → EQ → FX send
MasterFx.h/cpp          Bus master : orchestre tous les modules DSP du bus
DubSiren.h/cpp          Sirène dub monophonique : OSC phase + LFO + enveloppe pitch
ParametricEq.h/cpp      EQ paramétrique 4 bandes (SUB/KICK/MID/TOP, freq sweepable)
GraphicEq.h/cpp         EQ graphique 12 bandes fixes (40 Hz … 16 kHz)
FilterSection.h/cpp     HPF + LPF master avec fréquence et résonance réglables
BandTrim.h/cpp          Gain trim 4 bandes ±6 dB (SUB/KICK/MID/TOP)
KillSwitch.h/cpp        Kill 4 bandes sans clics (crossover parallèle LP/HP)
NoiseGate.h/cpp         Gate professionnel (peak follower + state machine)
Biquad.h/cpp            Filtre biquad IIR 2nd ordre (shelf, peak, LP, HP)
HardwareConfig.h        Constantes PHYSIQUES : mapping pots/switches, routing I/O, I2C
SoftwareConfig.h        Constantes DSP/COMPORTEMENT : EQ, gate, kills, siren, debug
gui/                    Sources GUI Bela (ES modules) — éditer ici, pas sketch.js directement
src/sketch.js           Bundle GUI généré (esbuild) — déployé sur Bela, ne pas éditer à la main
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
IN1 ──► ChannelStrip 2 ──► dry2 ──┤ fxSend (sum)
IN2 ──► ChannelStrip 3 ──► dry3 ──┤ ──► filtré par mode FX switch ──► OUT2
IN3 ──► ChannelStrip 4 ──► dry4 ──┤
         DubSiren ─────► sirenOut ─┘
                                   │
                               dry mix
                                   │
IN9 (retour FX) ──► NoiseGate ────►┤
                   (fxReturnGate_) │
                                   ▼
                           MasterFx.process()
                            ParametricEq (4 bandes peaking, freq log-sweepable)
                            → GraphicEq  (12 bandes peaking fixes)
                            → FilterSection (HPF → LPF, bypass mou sur activation)
                            → BandTrim   (4 bandes ±6 dB, shelf+peaking)
                            → KillSwitch (crossover parallèle 4 bandes)
                            → × masterGain
                                   │
                            OUT0 + OUT1 (mono)

VU meter (post-master, par bande) :
  OUT6 TOP  (> 1200 Hz)
  OUT7 MID  (200–1200 Hz)
  OUT8 KICK (80–200 Hz)
  OUT9 SUB  (< 80 Hz)
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
| Source AUX 3 | IN2 | `AUX3_CONFIG.audioIns[0]` |
| Source AUX 4 | IN3 | `AUX4_CONFIG.audioIns[0]` |
| Retour FX | IN9 | `FX1_RETURN_IN` |
| Sortie master L | OUT0 | `MASTER_OUT_L` |
| Sortie master R | OUT1 | `MASTER_OUT_R` |
| Départ FX | OUT2 | `FX1_SEND_OUT` |
| VU TOP | OUT6 | `VU_TOP_OUT` |
| VU MID | OUT7 | `VU_MID_OUT` |
| VU KICK | OUT8 | `VU_KICK_OUT` |
| VU SUB | OUT9 | `VU_SUB_OUT` |

---

## Mapping hardware actuel

`kActiveMux = 4`. La liste exhaustive des `PotRef` et `SwitchRef` est dans `HardwareConfig.h` — c'est la source de vérité pour les numéros de MUX/canal. Ne pas dupliquer ici.

**Groupes fonctionnels par MUX (vue d'ensemble) :**
- MUX 0 : channel strips 1 & 2 (EQ, siren mod/type)
- MUX 1 : graphic EQ (12 bandes) + band trim (4 bandes)
- MUX 2 : EQ paramétrique master (freq + gain × 4) + HPF/LPF (freq + res × 2)
- MUX 3 : gains d'entrée + FX sends (CH1, CH2, AUX3, AUX4, siren) + master gain

> Les `PotRef` avec le flag `centered = true` passent automatiquement par la courbe de puissance (`kCenteredPotExponent`). Pots ignorés : voir `kIgnoredPots` dans `HardwareConfig.h`.

**Switches (MCP23017 port A, 0x20) — 7 switches actifs :**
- 4 kills (SUB/KICK/MID/TOP)
- 2 modes FX send (MIDS only, TOPS only)
- 1 gate sirène (SIREN_TRIGGER)

---

## Paramètres DSP clés (SoftwareConfig.h)

| Constante | Valeur | Rôle |
|---|---|---|
| `kGateThreshold` | 0.001 | Seuil d'ouverture du gate (≈ -60 dBFS) |
| `kGateAttackMs` | 2 ms | Vitesse d'ouverture du gate |
| `kGateHoldMs` | 100 ms | Temps de maintien avant fermeture |
| `kGateReleaseMs` | 150 ms | Vitesse de fermeture |
| `kKillRampMs` | 30 ms | Durée fondu activation/désactivation kill |
| `kKillFilterStages` | 2 | Pentes : 2 × 12 = 24 dB/oct par bande |
| `kKillFc0` | 80 Hz | Frontière SUB/KICK |
| `kKillFc1` | 200 Hz | Frontière KICK/MID |
| `kKillFc2` | 1200 Hz | Frontière MID/TOP |
| `kEqLowFreq` | 250 Hz | Fréquence low shelf EQ canal |
| `kEqMidFreq` | 1000 Hz | Fréquence mid peak EQ canal |
| `kEqHighFreq` | 4000 Hz | Fréquence high shelf EQ canal |
| `kEqGainRangeDb` | 6 dB | Plage EQ canal (±6 dB) |
| `kEqGainSmoothMs` | 5 ms | Lissage des gains EQ (anti-clic sur sweep) |
| `kMasterEqGainRangeDb` | 6 dB | Plage EQ paramétrique master |
| `kGEqGainRangeDb` | 12 dB | Plage EQ graphique master |
| `kBandTrimGainDb` | 6 dB | Plage Band Trim (±6 dB) |
| `kHpfFMin/FMax` | 20–2000 Hz | Plage HPF |
| `kLpfFMin/FMax` | 200–20000 Hz | Plage LPF |
| `kFilterQMin/Max` | 0.7–4.5 | Plage résonance HPF/LPF |
| `kFilterOffThreshold` | 0.01 | Pot en dessous → filtre bypasse |
| `kFilterBypassRampMs` | 5 ms | Durée fondu bypass HPF/LPF (anti-clic) |
| `kCenteredPotExponent` | 2.0 | Exposant courbe puissance pots centrés |
| `kSirenGateAttackMs` | 5 ms | Attaque gate sirène |
| `kSirenGateReleaseMs` | 80 ms | Release gate sirène |
| `kSirenGainScale` | 0.1 | Niveau sirène relatif aux canaux |
| `kFxMidLowFreq` | 250 Hz | Borne basse mode MIDS (FX send) |
| `kFxMidHighFreq` | 4000 Hz | Borne haute mode MIDS / seuil TOPS |
| `kDebug` | true | Active le log des pots/switches dans render() |

---

## Conventions de code à respecter

1. **Documentation** : chaque méthode publique a un doc-comment court **en anglais**.
2. **Un objet = une mission.** Si une classe grossit, extraire dans un objet dédié.
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

### EQ gain smoothing (anti-clic sur potards)
Dans toutes les classes EQ (`ChannelStrip`, `ParametricEq`, `GraphicEq`, `BandTrim`), les gains ne sont **pas** appliqués directement aux biquads. Un lisseur one-pole per-sample converge vers la cible (`kEqGainSmoothMs = 5 ms`). Les coefficients biquad ne sont recalculés que lorsque le gain lissé a bougé de plus de ~0.05 dB. Cela élimine les clics lors du sweep des potards.

### EQ bypass automatique (ChannelStrip et autres)
Dans `ChannelStrip::process()` (et toutes les classes EQ), les filtres sont contournés lorsque les **gains lissés** (`smoothLow_`, `smoothMid_`, `smoothHigh_`) sont tous en dessous de `kGainEpsilonDb` (0.05 dB). Utilise les valeurs lissées, pas les cibles brutes — cela évite un bypass prématuré pendant la décroissance vers 0 dB.

### FilterSection (HPF/LPF) : bypass mou + state warm
Les deux biquads HPF et LPF tournent **en permanence** dans `process()`, même quand leur mix cible est 0. Cela maintient leur état interne (z1/z2) à jour. La transition bypass↔actif utilise un lisseur one-pole sur le mix sec/mouillé (`kFilterBypassRampMs = 5 ms`) pour éviter tout clic à l'activation.

### Courbe de puissance pour pots centrés
`getCenteredPotValue()` applique une courbe de puissance symétrique autour de 0.5 :
```
t = (v - 0.5) × 2     // [-1, +1]
output = sign(t) × |t|^kCenteredPotExponent × 0.5 + 0.5
```
Avec `kCenteredPotExponent = 2.0` : dérivée nulle au centre (insensible au jitter ADC sans snap artificiel), haute sensibilité aux extrêmes. Remplace l'ancien `kSnapRadiusCenter` (hard snap).

### ParametricEq : fréquence block-rate, gain per-sample
Les changements de fréquence dans `ParametricEq::setBand()` sont traités immédiatement (taux block, ~5.8 ms) en utilisant le gain **lissé courant** (pas la cible) pour éviter une discontinuité de gain lors du recalcul. Les changements de gain sont lissés per-sample dans `process()` comme les autres EQ.

---

## GUI Bela (sketch.js)

L'IDE Bela ne charge que `src/sketch.js`. Les sources vivent dans `gui/` à la racine (modules ES6, hors `src/` car non déployées).

**Workflow :**
1. Éditer les fichiers dans `gui/` (`main.js`, `config.js`, `dom/*`, `bela/*`)
2. `npm run build:gui` — regénère `src/sketch.js` via esbuild
3. Déployer / synchroniser le projet Bela (comme avant)

**Structure GUI :**
- `config.js` — constantes (must match `render.cpp` / `SoftwareConfig.h`)
- `state.js` + `context.js` — état mutable partagé
- `dom/` — onglets Live, Meters, Master EQ, Mapping, shell
- `bela/connection.js` — badge LIVE/LAG/OFFLINE

`npm run watch:gui` pour rebuild automatique en dev local.
