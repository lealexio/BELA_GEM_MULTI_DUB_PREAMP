/*
 * McpLedTestRender.cpp -- Test et pilotage d'une LED sur PA7 (MCP23017) avec Bela
 *
 * Ce fichier est autonome et prêt à être copié dans un projet Bela IDE (render.cpp).
 *
 * ============================================================================
 * CÂBLAGE DE LA LED SUR PA7 (Broche 28 du MCP23017) :
 * ============================================================================
 *
 *   Broche 28 (GPA7) ---> [ Résistance 220Ω à 1kΩ ] ---> Anode LED (+) [Patte longue]
 *                                                                │
 *                                                      Cathode LED (-) [Patte courte]
 *                                                                │
 *                                                               GND (Bela)
 *
 *   Note : Sur 3.3V, une résistance de 330Ω à 470Ω donne une luminosité idéale.
 *
 * ============================================================================
 * CÂBLAGE MCP23017 (Boîtier DIP-28) VERS BELA :
 * ============================================================================
 *   Broche 9  (VDD)   -> Bela 3.3V (P9.03 ou P9.04)
 *   Broche 10 (VSS)   -> Bela GND  (P9.01 ou P9.02)
 *   Broche 18 (RESET) -> Bela 3.3V (INDISPENSABLE : ne jamais laisser flottant !)
 *   Broche 12 (SCL)   -> Bela I2C-1 SCL (P9.17)
 *   Broche 13 (SDA)   -> Bela I2C-1 SDA (P9.18)
 *   Broches 15, 16, 17 (A0, A1, A2) -> Bela GND (pour adresse 0x20)
 *
 * ============================================================================
 * COMPORTEMENT :
 * ============================================================================
 *   Par défaut (MODE_BLINK) : La LED clignote à 1 Hz (500 ms Allumée / 500 ms Éteinte).
 *   Le clignotement permet de certifier immédiatement que la broche est activement
 *   pilotée par le code (et non juste bloquée au niveau haut).
 *   Vous pouvez aussi choisir MODE_ALWAYS_ON (fixe) ou MODE_FAST_BLINK ci-dessous.
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
// MODES DE FONCTIONNEMENT DE LA LED
// ============================================================================
enum LedMode {
    MODE_BLINK       = 0, // Clignotement standard 1 Hz (500 ms ON / 500 ms OFF) - Défaut
    MODE_ALWAYS_ON   = 1, // LED allumée en continu (HIGH fixe)
    MODE_FAST_BLINK  = 2, // Clignotement rapide 5 Hz (100 ms ON / 100 ms OFF)
    MODE_HEARTBEAT   = 3  // Double pulsation "battement de cœur"
};

// Choisissez le mode ici :
static constexpr LedMode kCurrentLedMode = MODE_BLINK;

// ============================================================================
// CONFIGURATION I2C & MCP23017
// ============================================================================

static const char* kI2cBus = "/dev/i2c-1";
static uint8_t     kDefaultMcpAddress = 0x20;

// Registres du MCP23017 (mode BANK=0 standard)
static constexpr uint8_t MCP_IODIRA = 0x00; // Direction Port A (0 = Sortie, 1 = Entrée)
static constexpr uint8_t MCP_IODIRB = 0x01; // Direction Port B (1 = Entrée)
static constexpr uint8_t MCP_GPIOA  = 0x12; // Registre de sortie / lecture Port A
static constexpr uint8_t MCP_OLATA  = 0x14; // Output Latch Port A

// Bit correspondant à PA7 (bit 7 = 0b10000000 = 0x80)
static constexpr uint8_t kPinMaskPA7 = (1 << 7); // 0x80

// ============================================================================
// ÉTAT GLOBAL
// ============================================================================

static int  gI2cFd = -1;
static uint8_t gActiveAddress = 0;
static std::atomic<bool> gMcpConnected{false};

// État courant de la LED (true = Allumée / HIGH, false = Éteinte / LOW)
static std::atomic<bool> gLedState{false};

// Tâche non-RT pour piloter l'I2C sans impacter le temps réel audio
static AuxiliaryTask gI2cTask;

// ============================================================================
// INITIALISATION DU MCP23017
// ============================================================================

static bool probeAndInitMcp(uint8_t addr)
{
    if(ioctl(gI2cFd, I2C_SLAVE, addr) < 0) return false;

    // Configuration IODIRA : PA7 en SORTIE (bit 7 = 0), les autres en entrées (bits 0-6 = 1)
    // 0x7F = 0b01111111 -> PA7 = 0 (OUTPUT)
    uint8_t buf[2];
    buf[0] = MCP_IODIRA;
    buf[1] = 0x7F;
    if(write(gI2cFd, buf, 2) != 2) return false;

    // Port B tout en entrée par sécurité
    buf[0] = MCP_IODIRB;
    buf[1] = 0xFF;
    if(write(gI2cFd, buf, 2) != 2) return false;

    // Initialise la sortie PA7 à l'état bas (0 = LOW)
    buf[0] = MCP_OLATA;
    buf[1] = 0x00;
    if(write(gI2cFd, buf, 2) != 2) return false;

    return true;
}

/** Écrit l'état de la LED sur PA7 via I2C (true = HIGH, false = LOW) */
static bool setPa7Led(bool state)
{
    if(gI2cFd < 0 || !gMcpConnected.load()) return false;

    uint8_t buf[2];
    buf[0] = MCP_OLATA;
    buf[1] = state ? kPinMaskPA7 : 0x00;

    return (write(gI2cFd, buf, 2) == 2);
}

// ============================================================================
// TÂCHE AUXILIAIRE I2C (Thread non-RT)
// ============================================================================

static void ledControlTask(void*)
{
    bool lastState = false;
    unsigned int step = 0;

    while(!Bela_stopRequested()) {
        if(gMcpConnected.load()) {
            bool desiredState = false;

            switch(kCurrentLedMode) {
                case MODE_ALWAYS_ON:
                    desiredState = true;
                    usleep(100000); // 100 ms
                    break;

                case MODE_BLINK:
                    // 500 ms ON, 500 ms OFF (1 Hz)
                    desiredState = (step % 2 == 0);
                    step++;
                    usleep(500000); // 500 ms
                    break;

                case MODE_FAST_BLINK:
                    // 100 ms ON, 100 ms OFF (5 Hz)
                    desiredState = (step % 2 == 0);
                    step++;
                    usleep(100000); // 100 ms
                    break;

                case MODE_HEARTBEAT:
                    // Battement : ON (100ms) -> OFF (100ms) -> ON (100ms) -> OFF (700ms)
                    step = step % 4;
                    if(step == 0) {
                        desiredState = true;
                        usleep(120000);
                    } else if(step == 1) {
                        desiredState = false;
                        usleep(120000);
                    } else if(step == 2) {
                        desiredState = true;
                        usleep(120000);
                    } else {
                        desiredState = false;
                        usleep(640000);
                    }
                    step++;
                    break;
            }

            // Application de la nouvelle valeur I2C
            if(!setPa7Led(desiredState)) {
                rt_printf("ATTENTION: Erreur d'ecriture I2C vers le MCP23017 !\n");
                gMcpConnected.store(false);
            } else {
                gLedState.store(desiredState);
                if(desiredState != lastState || kCurrentLedMode == MODE_ALWAYS_ON) {
                    if(desiredState) {
                        rt_printf("[MCP23017 PA7 / Pin 28] ---> [ ALLUMEE (HIGH 3.3V) ]  (o)\n");
                    } else {
                        rt_printf("[MCP23017 PA7 / Pin 28] ---> [ ETEINTE (LOW  0.0V) ]  ( )\n");
                    }
                    lastState = desiredState;
                }
            }

        } else {
            // Tentative de reconnexion
            if(probeAndInitMcp(gActiveAddress)) {
                rt_printf("MCP23017 reconnecte a l'adresse 0x%02X !\n", gActiveAddress);
                gMcpConnected.store(true);
            }
            usleep(500000);
        }
    }

    // Éteindre la LED avant de quitter
    setPa7Led(false);
}

// ============================================================================
// SETUP
// ============================================================================

bool setup(BelaContext *context, void *userData)
{
    rt_printf("\n=========================================================\n");
    rt_printf("       TEST MCP23017 -- PILOTAGE LED PA7 (Pin 28)        \n");
    rt_printf("=========================================================\n");

    // Ouverture du bus I2C
    gI2cFd = open(kI2cBus, O_RDWR);
    if(gI2cFd < 0) {
        rt_printf("ERREUR: Impossible d'ouvrir le bus I2C %s\n", kI2cBus);
        return false;
    }

    // Détection à 0x20 ou scan 0x20..0x27
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
        rt_printf("Verifiez VDD (pin 9), VSS (pin 10), RESET au 3.3V (pin 18) et SCL/SDA.\n\n");
        close(gI2cFd);
        gI2cFd = -1;
        return false;
    }

    gMcpConnected.store(true);

    rt_printf("[OK] MCP23017 detecte a l'adresse 0x%02X\n", gActiveAddress);
    rt_printf("Configuration : Broche 28 (GPA7) configuree en SORTIE (OUTPUT).\n");

    if(kCurrentLedMode == MODE_BLINK) {
        rt_printf("Mode actif    : CLIGNOTEMENT 1 Hz (500ms ON / 500ms OFF)\n");
    } else if(kCurrentLedMode == MODE_ALWAYS_ON) {
        rt_printf("Mode actif    : ALLUMEE FIXE (HIGH)\n");
    } else if(kCurrentLedMode == MODE_FAST_BLINK) {
        rt_printf("Mode actif    : CLIGNOTEMENT RAPIDE 5 Hz\n");
    } else if(kCurrentLedMode == MODE_HEARTBEAT) {
        rt_printf("Mode actif    : BATTEMENT DE COEUR (Heartbeat)\n");
    }

    rt_printf("--> Observez la LED branchee sur la broche 28 (GPA7) !\n\n");

    // Lancement du thread de commande I2C
    gI2cTask = Bela_createAuxiliaryTask(ledControlTask, 50, "mcp-led-task", nullptr);
    Bela_scheduleAuxiliaryTask(gI2cTask);

    return true;
}

// ============================================================================
// RENDER (Génération de silence audio)
// ============================================================================

void render(BelaContext *context, void *userData)
{
    // Silence sur toutes les sorties audio
    for(unsigned int n = 0; n < context->audioFrames; ++n) {
        for(unsigned int ch = 0; ch < context->audioOutChannels; ++ch) {
            audioWrite(context, n, ch, 0.0f);
        }
    }
}

// ============================================================================
// CLEANUP
// ============================================================================

void cleanup(BelaContext *context, void *userData)
{
    gMcpConnected.store(false);
    if(gI2cFd >= 0) {
        // Éteint la LED avant fermeture
        uint8_t buf[2] = {MCP_OLATA, 0x00};
        write(gI2cFd, buf, 2);

        close(gI2cFd);
        gI2cFd = -1;
    }
    rt_printf("Test MCP LED termine. LED PA7 eteinte.\n");
}

