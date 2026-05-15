# Architecture du Projet : Préampli Dub "Sage Sound" Style (Bela Gem Multi)

Ce document définit la structure logicielle et les agents (modules) nécessaires pour coder le préampli sur Bela Gem Multi en C++.

## 1. Vue d'ensemble de l'Architecture
L'application repose sur un système multi-threadé pour garantir une latence ultra-basse sans craquements audio.

* **Thread Temps Réel (Priorité 95+) :** Traitement audio pur (DSP).
* **Thread Auxiliaire (Priorité 50-70) :** Lecture du matériel (Multiplexeurs & I2C).
* **Thread Système :** IDE Web, Oscilloscope et logs.

---

## 2. Définition des Agents / Modules

### A. Hardware Manager (`HardwareManager.h/cpp`)
Cet agent est responsable de l'abstraction du matériel.
* **Responsabilités :**
    * Piloter les 4 multiplexeurs CD74HC4067 (scan des 64 potentiomètres).
    * Gérer la communication I2C avec les MCP23017 (lecture des switches).
    * Appliquer un **Smoothing (Lissage)** sur les valeurs brutes pour éviter le "zipper noise".
* **Output :** Un tableau de 64 `float` (0.0 - 1.0) et un état binaire pour chaque switch.

### B. DSP Engine (`DspEngine.h/cpp`)
Le moteur audio qui transforme le signal.
* **Responsabilités :**
    * **Crossover :** Séparation du signal en 4 bandes (Sub, Bass, Mids, Tops).
    * **Filtrage Paramétrique :** Implémentation des filtres Biquad pour les sections `FREQ` et `GAIN/TONE`.
    * **FX Send :** Gestion des départs auxiliaires avec filtrage pré-FX (Full/Mids/Tops).
    * **Saturation :** Simulation de chaleur analogique (Soft-clipping).

### C. Logic Controller (`PreampliLogic.h/cpp`)
L'agent qui fait le lien entre les boutons physiques et les paramètres audio.
* **Responsabilités :**
    * Mapper les valeurs des potards vers les fréquences (ex: 0.0-1.0 -> 50Hz-200Hz).
    * Gérer les états des switches (Bypass, FX Mode).
    * Mettre à jour les coefficients des filtres dans le thread audio de manière sécurisée.

---

## 3. Workflow de Développement

1.  **Phase 1 (Hardware Check) :** Valider la lecture d'un multiplexeur dans une `AuxiliaryTask`.
2.  **Phase 2 (Basic DSP) :** Implémenter le gain lissé et le FX send simple dans `render()`.
3.  **Phase 3 (Filter Design) :** Créer les classes de filtres Biquad pour les sections Sub/Mids/Tops.
4.  **Phase 4 (Integration) :** Relier les 64 contrôles aux paramètres du `DspEngine`.

## 4. Recommandations Techniques

* **Langage :** C++ (standard Bela).
* **Bibliothèques :** `Bela.h`, `libraries/Biquad/Biquad.h`.
* **Optimisation :** Utiliser des variables atomiques pour le partage de données entre threads si nécessaire.
* **Sécurité :** Prévoir un mode "Read-Only" pour la carte SD une fois le projet finalisé.
