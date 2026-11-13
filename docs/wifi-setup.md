# Bela Wi-Fi & Hotspot Configuration

This guide explains how to connect a USB Wi-Fi dongle to the Bela Gem Multi board and set up an automatic fallback access point (hotspot) so the web IDE and GUI remain accessible even without a local router.

---

## 1. Prerequisites: System Update (Mandatory)

**Before plugging in your Wi-Fi dongle**, ensure the Bela Linux system image is fully up to date so that the necessary wireless kernel drivers and firmware are present:

1. Connect Bela to your computer via USB.
2. Open the IDE at `http://bela.local`.
3. Navigate to **Settings** $\rightarrow$ **Check for updates**.
4. Reboot the board after updating, then insert the USB Wi-Fi dongle into Bela's host USB port.

---

## 2. Verify Wi-Fi Dongle Detection

Log into Bela via SSH:

```bash
ssh root@bela.local
```

Verify that the wireless interface is detected using `iwctl`:

```bash
iwctl device list
```
*Expected output: a device listed as `wlan0` (or similar) in `station` mode.*

---

## 3. Connect to a Local Wi-Fi Network

To connect to your home or studio wireless router:

```bash
# 1. Scan for nearby wireless networks
iwctl station wlan0 scan
iwctl station wlan0 get-networks

# 2. Connect using your network credentials
iwctl --passphrase "YourNetworkPassword" station wlan0 connect "YourNetworkSSID"

# 3. Verify IP address assignment
ip a show dev wlan0
ping -c 3 8.8.8.8
```

Credentials are automatically saved in `/var/lib/iwd/` and will reconnect automatically on boot.

---

## 4. Automatic Hotspot Fallback Setup

When taking the preamp to a live sound system, festival, or venue with no local Wi-Fi router (or if the home Wi-Fi is lost during operation), Bela runs a lightweight background watcher daemon.
- **At boot:** Attempts to connect to known Wi-Fi networks for ~25 seconds. If no IP is assigned, it smoothly transitions the interface to AP mode and broadcasts `bela-hotspot`.
- **In operation (Dynamic Watcher):** If the Wi-Fi signal drops or the router is turned off for more than 15 seconds, the daemon automatically switches `wlan0` to AP mode and starts `bela-hotspot`.

### Step 4.1: Enable Network Configuration in `iwd`

Edit `/etc/iwd/main.conf` and ensure network configuration is enabled so that `iwd` provides built-in DHCP server capabilities for the AP:

```ini
[General]
EnableNetworkConfiguration=true
```

Restart `iwd` to apply:
```bash
systemctl restart iwd
```

### Step 4.2: Create the Hotspot Profile

Create `/var/lib/iwd/ap/bela-hotspot.ap`:

```bash
mkdir -p /var/lib/iwd/ap/
nano /var/lib/iwd/ap/bela-hotspot.ap
```

Add the following configuration:

```ini
[Security]
Passphrase=fullavibes

[IPv4]
Address=192.168.101.1
Gateway=192.168.101.1
Netmask=255.255.255.0
```

*Set permissions to 600:*
```bash
chmod 600 /var/lib/iwd/ap/bela-hotspot.ap
```

### Step 4.3: Create the Dynamic Watcher Script

Create `/usr/local/bin/wifi-fallback.sh`:

```bash
nano /usr/local/bin/wifi-fallback.sh
chmod +x /usr/local/bin/wifi-fallback.sh
```

Paste the following script:

```bash
#!/bin/bash
# ==============================================================================
# wifi-fallback.sh — Dynamic Wi-Fi station watcher and fallback hotspot daemon
# ==============================================================================

HOTSPOT_PROFILE="bela-hotspot"
INTERFACE="wlan0"
BOOT_GRACE_TIME=25       # Seconds to wait at startup for Wi-Fi station connect
DISCONNECT_GRACE_TIME=15 # Seconds of lost connection before starting hotspot
CHECK_INTERVAL=5         # Polling loop interval in seconds

# Helper: check if wlan0 has a valid station IPv4 address (not the hotspot IP)
has_station_ip() {
    ip -4 addr show "$INTERFACE" 2>/dev/null | grep 'inet ' | grep -v '192.168.101.' >/dev/null 2>&1
}

# Helper: check current mode in iwd (station or ap)
get_mode() {
    /usr/bin/iwctl device "$INTERFACE" show 2>/dev/null | grep -i 'Mode' | grep -oE 'ap|station'
}

# Helper: check if AP is currently started
is_ap_started() {
    /usr/bin/iwctl ap "$INTERFACE" show 2>/dev/null | grep -E "Started\s+yes" >/dev/null 2>&1
}

# Helper: safely start hotspot
start_hotspot() {
    echo "wifi-fallback: starting hotspot profile '$HOTSPOT_PROFILE'..."

    # Ensure any active station activity is stopped
    /usr/bin/iwctl station "$INTERFACE" disconnect 2>/dev/null
    sleep 1

    # Switch device to AP mode if not already in AP mode
    CURRENT_MODE=$(get_mode)
    if [ "$CURRENT_MODE" != "ap" ]; then
        echo "wifi-fallback: setting $INTERFACE mode to ap..."
        /usr/bin/iwctl device "$INTERFACE" set-property Mode ap 2>/dev/null
        sleep 2
    fi

    # Try starting the AP profile with retries
    for attempt in 1 2 3 4 5; do
        if is_ap_started; then
            echo "wifi-fallback: hotspot is already running."
            return 0
        fi
        echo "wifi-fallback: attempting to start AP profile (attempt $attempt/5)..."
        if /usr/bin/iwctl ap "$INTERFACE" start-profile "$HOTSPOT_PROFILE" 2>/dev/null; then
            echo "wifi-fallback: hotspot started successfully!"
            return 0
        fi
        sleep 2
    done

    echo "wifi-fallback: failed to start hotspot after 5 attempts."
    return 1
}

# --- INITIAL BOOT / STARTUP SEQUENCE ---
echo "wifi-fallback: daemon started."
INIT_MODE=$(get_mode)

if [ "$INIT_MODE" = "station" ]; then
    echo "wifi-fallback: waiting up to ${BOOT_GRACE_TIME}s for Wi-Fi station connection..."
    ELAPSED=0
    while [ $ELAPSED -lt $BOOT_GRACE_TIME ]; do
        if has_station_ip; then
            IP=$(ip -4 addr show "$INTERFACE" | grep 'inet ' | awk '{print $2}')
            echo "wifi-fallback: connected at boot with IP $IP"
            break
        fi
        sleep 1
        ELAPSED=$((ELAPSED + 1))
    done

    if ! has_station_ip; then
        echo "wifi-fallback: no connection after ${BOOT_GRACE_TIME}s. Launching fallback hotspot."
        start_hotspot
    fi
else
    # Started while in AP mode
    if ! is_ap_started; then
        start_hotspot
    else
        echo "wifi-fallback: AP mode already active."
    fi
fi

# --- CONTINUOUS WATCHER LOOP ---
LOST_COUNT=0
LOST_THRESHOLD=$((DISCONNECT_GRACE_TIME / CHECK_INTERVAL))

while true; do
    sleep "$CHECK_INTERVAL"

    CURRENT_MODE=$(get_mode)

    if [ "$CURRENT_MODE" = "ap" ]; then
        # In AP mode: ensure AP remains active
        if ! is_ap_started; then
            echo "wifi-fallback: AP stopped unexpectedly, restarting..."
            start_hotspot
        fi
        continue
    fi

    # In station mode: monitor IP connectivity
    if has_station_ip; then
        LOST_COUNT=0
    else
        LOST_COUNT=$((LOST_COUNT + 1))
        if [ "$LOST_COUNT" -ge "$LOST_THRESHOLD" ]; then
            echo "wifi-fallback: Wi-Fi lost for >${DISCONNECT_GRACE_TIME}s. Switching to hotspot."
            start_hotspot
            LOST_COUNT=0
        fi
    fi
done
```

### Step 4.4: Create the Systemd Service

Create `/etc/systemd/system/wifi-fallback.service`:

```bash
nano /etc/systemd/system/wifi-fallback.service
```

Add:

```ini
[Unit]
Description=WiFi fallback to hotspot if no network available
After=iwd.service
Requires=iwd.service

[Service]
Type=simple
ExecStart=/usr/local/bin/wifi-fallback.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Step 4.5: Enable and Test

```bash
systemctl daemon-reload
systemctl enable wifi-fallback.service
systemctl restart wifi-fallback.service
journalctl -u wifi-fallback.service -f
```

### Hotspot Connection Summary
- **SSID:** `bela-hotspot`
- **Passphrase:** `fullavibes`
- **Preamp IP:** `192.168.101.1`
- **Web GUI / IDE URL:** `http://192.168.101.1/gui/` (or `http://192.168.101.1` for Bela IDE)

---

## 5. Manually Switching Back to Station Mode

To manually stop the hotspot and reconnect to a regular Wi-Fi network:

```bash
iwctl ap wlan0 stop
iwctl device wlan0 set-property Mode station
iwctl station wlan0 connect "YourNetworkSSID"
```

