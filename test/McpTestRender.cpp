/*
 * McpTestRender.cpp -- Diagnostic et test interactif du MCP23017 sur Bela
 * 
 * Ce fichier est autonome et prêt à être copié dans un projet Bela IDE (render.cpp).
 *
 * CÂBLAGE REQUIS (MCP23017 boîtier DIP-28) :
 * -------------------------------------------------------------
 *   Broche 9  (VDD)   -> Bela 3.3V (P9.03 ou P9.04)
 *   Broche 10 (VSS)   -> Bela GND  (P9.01 ou P9.02)
 *   Broche 18 (RESET) -> Bela 3.3V (TRÈS IMPORTANT : ne pas laisser en l'air !)
 *   Broche 12 (SCL)   -> Bela I2C-1 SCL (P9.17)
 *   Broche 13 (SDA)   -> Bela I2C-1 SDA (P9.18)
 *   Broche 15 (A0)    -> Bela GND (pour adresse 0x20)
 *   Broche 16 (A1)    -> Bela GND
 *   Broche 17 (A2)    -> Bela GND
 *
 * BROCHES D'E/S À TESTER :
 * -------------------------------------------------------------
 *   PORT A : Broches DIP 21 à 28 (GPA0 à GPA7)
 *   PORT B : Broches DIP 1  à 8  (GPB0 à GPB7)
 *
 * PRINCIPE DU TEST :
 * -------------------------------------------------------------
 *   1. Toutes les broches sont configurées en ENTRÉES avec PULL-UP interne 100k activé.
 *   2. Quand une broche est "en l'air" (non touchée) -> état HIGH -> affiche "OPEN".
 *   3. Prenez un fil relié au GND de la Bela et touchez une broche :
 *      -> état LOW -> affiche instantanément "CLOSED <===".
 */

#include <Bela.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <linux/i2c-dev.h>
#include <cstdint>
#include <cstdio>
#include <atomic>

// ============================================================================
// CONFIGURATION I2C
// ============================================================================

static const char* kI2cBus = "/dev/i2c-1";
static uint8_t     kDefaultMcpAddress = 0x20;

// Registres du MCP23017 (mode BANK=0 par défaut)
static constexpr uint8_t MCP_IODIRA = 0x00; // Direction Port A (1 = entrée)
static constexpr uint8_t MCP_IODIRB = 0x01; // Direction Port B (1 = entrée)
static constexpr uint8_t MCP_GPPUA  = 0x0C; // Pull-up Port A (1 = activé)
static constexpr uint8_t MCP_GPPUB  = 0x0D; // Pull-up Port B (1 = activé)
static constexpr uint8_t MCP_GPIOA  = 0x12; // Lecture Port A
static constexpr uint8_t MCP_GPIOB  = 0x13; // Lecture Port B

// Correspondance des broches physiques DIP-28
static const int kDipPinA[8] = {21, 22, 23, 24, 25, 26, 27, 28};
static const int kDipPinB[8] = { 1,  2,  3,  4,  5,  6,  7,  8};

// ============================================================================
// ÉTAT GLOBAL (Partagé entre thread I2C et render)
// ============================================================================

static int  gI2cFd = -1;
static uint8_t gActiveAddress = 0;
static std::atomic<bool> gMcpConnected{false};

// Valeurs lues des ports (0xFF = toutes les broches au repos / HIGH / OPEN)
static std::atomic<uint8_t> gPortA{0xFF};
static std::atomic<uint8_t> gPortB{0xFF};

// Tâche d'arrière-plan pour les accès I2C (I/O bloquant interdit dans render)
static AuxiliaryTask gI2cTask;

// Période d'affichage du tableau récapitulatif dans la console (en frames audio)
static unsigned int gPrintCounter = 0;

// ============================================================================
// FONCTIONS I2C (Non-RT)
// ============================================================================

/** Tente de détecter et initialiser le MCP23017 à l'adresse spécifiée. */
static bool probeAndInitMcp(uint8_t addr)
{
    if(ioctl(gI2cFd, I2C_SLAVE, addr) < 0) return false;

    // Test d'écriture du registre IODIRA (tout en entrée = 0xFF)
    uint8_t buf[2];
    buf[0] = MCP_IODIRA; buf[1] = 0xFF;
    if(write(gI2cFd, buf, 2) != 2) return false;

    // IODIRB : tout en entrée
    buf[0] = MCP_IODIRB; buf[1] = 0xFF;
    if(write(gI2cFd, buf, 2) != 2) return false;

    // GPPUA : active les pull-ups internes sur Port A
    buf[0] = MCP_GPPUA; buf[1] = 0xFF;
    if(write(gI2cFd, buf, 2) != 2) return false;

    // GPPUB : active les pull-ups internes sur Port B
    buf[0] = MCP_GPPUB; buf[1] = 0xFF;
    if(write(gI2cFd, buf, 2) != 2) return false;

    return true;
}

/** Tâche périodique I2C exécutée dans un thread auxiliaire non-RT (~200 Hz). */
static void readI2cTask(void*)
{
    uint8_t lastA = 0xFF;
    uint8_t lastB = 0xFF;

    while(!Bela_stopRequested()) {
        if(gMcpConnected.load()) {
            uint8_t regA = MCP_GPIOA;
            uint8_t valA = 0xFF;
            uint8_t regB = MCP_GPIOB;
            uint8_t valB = 0xFF;

            bool ok = true;
            if(write(gI2cFd, &regA, 1) != 1 || read(gI2cFd, &valA, 1) != 1) ok = false;
            if(ok && (write(gI2cFd, &regB, 1) != 1 || read(gI2cFd, &valB, 1) != 1)) ok = false;

            if(ok) {
                // Détection immédiate des changements pour journalisation instantanée
                if(valA != lastA) {
                    for(int i = 0; i < 8; ++i) {
                        bool oldBit = (lastA >> i) & 1;
                        bool newBit = (valA  >> i) & 1;
                        if(oldBit != newBit) {
                            if(!newBit) {
                                rt_printf(">>> [CONTACT DETECTE] Port A: GPA%d (DIP pin %d) -> CLOSED <<<\n", i, kDipPinA[i]);
                            } else {
                                rt_printf("    [CONTACT RELACHE] Port A: GPA%d (DIP pin %d) -> OPEN\n", i, kDipPinA[i]);
                            }
                        }
                    }
                    lastA = valA;
                }

                if(valB != lastB) {
                    for(int i = 0; i < 8; ++i) {
                        bool oldBit = (lastB >> i) & 1;
                        bool newBit = (valB  >> i) & 1;
                        if(oldBit != newBit) {
                            if(!newBit) {
                                rt_printf(">>> [CONTACT DETECTE] Port B: GPB%d (DIP pin %d) -> CLOSED <<<\n", i, kDipPinB[i]);
                            } else {
                                rt_printf("    [CONTACT RELACHE] Port B: GPB%d (DIP pin %d) -> OPEN\n", i, kDipPinB[i]);
                            }
                        }
                    }
                    lastB = valB;
                }

                gPortA.store(valA);
                gPortB.store(valB);
            } else {
                rt_printf("ATTENTION: Perte de communication I2C avec le MCP23017 !\n");
                gMcpConnected.store(false);
            }
        } else {
            // Tentative de reconnexion automatique toutes les 500 ms
            if(probeAndInitMcp(gActiveAddress)) {
                rt_printf("MCP23017 reconnecte avec succes a l'adresse 0x%02X !\n", gActiveAddress);
                gMcpConnected.store(true);
            }
            usleep(500000);
            continue;
        }

        // Pause de 5 ms entre chaque lecture (~200 lectures par seconde)
        usleep(5000);
    }
}

// ============================================================================
// SETUP
// ============================================================================

bool setup(BelaContext *context, void *userData)
{
    rt_printf("\n=========================================================\n");
    rt_printf("          TEST MCP23017 -- DEMARRAGE                     \n");
    rt_printf("=========================================================\n");

    // Ouverture du bus I2C
    gI2cFd = open(kI2cBus, O_RDWR);
    if(gI2cFd < 0) {
        rt_printf("ERREUR: Impossible d'ouvrir le bus I2C %s\n", kI2cBus);
        rt_printf("Verifiez que l'I2C est actif sur votre Bela.\n");
        return false;
    }

    // Recherche du MCP23017 : d'abord à 0x20, sinon scan de 0x20 à 0x27
    bool found = false;
    if(probeAndInitMcp(kDefaultMcpAddress)) {
        gActiveAddress = kDefaultMcpAddress;
        found = true;
    } else {
        rt_printf("MCP23017 non detecte a 0x%02X, scan des adresses 0x20..0x27...\n", kDefaultMcpAddress);
        for(uint8_t a = 0x20; a <= 0x27; ++a) {
            if(probeAndInitMcp(a)) {
                gActiveAddress = a;
                found = true;
                break;
            }
        }
    }

    if(!found) {
        rt_printf("\n[ECHEC] Aucun MCP23017 detecte sur le bus %s !\n", kI2cBus);
        rt_printf("Verifications a effectuer :\n");
        rt_printf("  1. Broche 9 (VDD) reliee au 3.3V et broche 10 (VSS) au GND.\n");
        rt_printf("  2. Broche 18 (RESET) bien reliee au 3.3V (tres frequent !).\n");
        rt_printf("  3. Broches 12 (SCL) et 13 (SDA) bien branchees (P9.17 et P9.18).\n");
        rt_printf("  4. Broches 15, 16, 17 (A0, A1, A2) reliees au GND (adresse 0x20).\n\n");
        close(gI2cFd);
        gI2cFd = -1;
        return false;
    }

    gMcpConnected.store(true);

    rt_printf("[OK] MCP23017 initialise a l'adresse 0x%02X sur %s\n", gActiveAddress, kI2cBus);
    rt_printf("Pull-ups internes 100k actives sur Port A et Port B.\n");
    rt_printf("--> Prenez un fil relie au GND et touchez les broches pour tester !\n\n");

    // Lancement de la tâche de lecture I2C en arrière-plan
    gI2cTask = Bela_createAuxiliaryTask(readI2cTask, 50, "mcp-i2c-reader", nullptr);
    Bela_scheduleAuxiliaryTask(gI2cTask);

    return true;
}

// ============================================================================
// RENDER (Affichage console régulier et silence audio)
// ============================================================================

void render(BelaContext *context, void *userData)
{
    // Génère du silence audio pour éviter les bruits parasites
    for(unsigned int n = 0; n < context->audioFrames; ++n) {
        for(unsigned int ch = 0; ch < context->audioOutChannels; ++ch) {
            audioWrite(context, n, ch, 0.0f);
        }
    }

    // Affichage régulier du tableau complet toutes les ~400 ms
    gPrintCounter += context->audioFrames;
    if(gPrintCounter >= (unsigned int)(context->audioSampleRate * 0.40f)) {
        gPrintCounter = 0;

        if(!gMcpConnected.load()) {
            rt_printf("\n--- MCP23017 DECONNECTE (Tentative de reconnexion en cours...) ---\n");
            return;
        }

        uint8_t a = gPortA.load();
        uint8_t b = gPortB.load();

        rt_printf("\n======================================================================\n");
        rt_printf(" STATUT MCP23017 [Addr 0x%02X] (Fil sur GND -> CLOSED | En l'air -> OPEN)\n", gActiveAddress);
        rt_printf("======================================================================\n");
        rt_printf("        PORT A (DIP 21-28)         |        PORT B (DIP 1-8)          \n");
        rt_printf("-----------------------------------+----------------------------------\n");

        for(int i = 0; i < 8; ++i) {
            bool stateA = (a >> i) & 1; // 1 = HIGH (OPEN), 0 = LOW (CLOSED)
            bool stateB = (b >> i) & 1;

            const char* strA = stateA ? "OPEN       " : "CLOSED <===";
            const char* strB = stateB ? "OPEN       " : "CLOSED <===";

            rt_printf("  GPA%d (pin %2d) : %s    |   GPB%d (pin %2d) : %s\n",
                      i, kDipPinA[i], strA,
                      i, kDipPinB[i], strB);
        }
        rt_printf("-----------------------------------+----------------------------------\n");
        rt_printf("  Registre GPIOA : 0x%02X             |   Registre GPIOB : 0x%02X\n", a, b);
        rt_printf("======================================================================\n");
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

void cleanup(BelaContext *context, void *userData)
{
    gMcpConnected.store(false);
    if(gI2cFd >= 0) {
        close(gI2cFd);
        gI2cFd = -1;
    }
    rt_printf("Test MCP23017 termine.\n");
}

