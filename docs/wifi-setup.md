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

When taking the preamp to a live sound system or venue with no Wi-Fi router, this setup attempts to connect to known networks for 20 seconds. If no connection is established, Bela automatically spawns its own Wi-Fi Hotspot (`bela-hotspot`).

### Step 4.1: Enable Network Configuration in `iwd`

Edit `/etc/iwd/main.conf` and ensure network configuration is enabled:

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
Passphrase=BelaGemPreamp

[IPv4]
Address=192.168.101.1
Gateway=192.168.101.1
Netmask=255.255.255.0
```

### Step 4.3: Create the Fallback Script

Create `/usr/local/bin/wifi-fallback.sh`:

```bash
nano /usr/local/bin/wifi-fallback.sh
chmod +x /usr/local/bin/wifi-fallback.sh
```

Paste the following script:

```bash
#!/bin/bash
# Wait for iwd to initialize and attempt auto-connection
sleep 8

MAX_WAIT=20
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    IP=$(ip -4 addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}')
    if [ -n "$IP" ]; then
        echo "wifi-fallback: connected with IP $IP"
        exit 0
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

# If no connection after timeout, switch to AP mode
echo "wifi-fallback: no connection after ${MAX_WAIT}s, starting fallback hotspot"
/usr/bin/iwctl device wlan0 set-property Mode ap
sleep 1
/usr/bin/iwctl ap wlan0 start-profile bela-hotspot
```

### Step 4.4: Create the Systemd Service

Create `/etc/systemd/system/wifi-fallback.service`:

```bash
nano /etc/systemd/system/wifi-fallback.service
```

Add:

```ini
[Unit]
Description=Wi-Fi fallback to hotspot if no network available
After=iwd.service
Requires=iwd.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/wifi-fallback.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

### Step 4.5: Enable and Test

```bash
systemctl daemon-reload
systemctl enable wifi-fallback.service
systemctl start wifi-fallback.service
```

### Hotspot Connection Summary
- **SSID:** `bela-hotspot`
- **Passphrase:** `BelaGemPreamp`
- **Preamp IP:** `192.168.101.1`
- **Web GUI / IDE URL:** `http://192.168.101.1/gui/`

---

## 5. Manually Switching Back to Station Mode

To manually stop the hotspot and reconnect to a regular Wi-Fi network:

```bash
iwctl ap wlan0 stop
iwctl device wlan0 set-property Mode station
iwctl station wlan0 connect "YourNetworkSSID"
```

