# Switchboard for Monster-UI

This app allows you to view registered devices, with user/extension labels (including hotdesk extensions they are logged into), and you can view their call status in real time.

The device's current extension appears in the lower right of the device object. Normally, it will be red. If a device has hotdesk users on it, the normal extension turns grey and the hotdesk extension[s] is displayed in pulsing blue above the normal extension.

The "Lite" version is completely free and open source (released under the GPLv3). I would love for you to let me know if you are using it! Also give me a Github star if you find it useful. :-)

The "Pro" version does everything the Lite version does, but it also allows you to answer/pickup calls, park calls, transfer calls, and shows parked calls in the parkinglot (and allows you to retrieve them with a click). Contact me via my site [https://ruhnet.co](https://ruhnet.co) for purchase information.

## Installation
Clone the repository to your Monster UI apps directory (often /var/www/html/monster-ui/apps, but may be different on your system). Then you may register the app on KAZOO with a sup command (with your specific Crossbar API location):

```bash
cd /var/www/html/monster-ui/apps

git clone https://github.com/ruhnet/monster-ui-switchboard-lite switchboard

sup crossbar_maintenance init_app '/var/www/html/monster-ui/apps/switchboard' \
'http://mycrossbarapi.tld:8000/v2'
```

![Switchboard Main Screen](https://github.com/ruhnet/monster-ui-switchboard-lite/raw/master/metadata/screenshots/switchboard.png)

