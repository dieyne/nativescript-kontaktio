declare var com, android: any;
import application = require('application');
import { requestPermission } from './permissions';

export interface Beacon {
    uuid: string;
    major: string;
    minor: string;
    proximity: Proximity;
    description: string;
    address: string;
}

export enum Proximity {
    UNKNOWN = 0,
    IMMEDIATE = 1,
    NEAR = 2,
    FAR = 3
}

const KontaktSDK = com.kontakt.sdk.android.common.KontaktSDK;
const ProximityManager = com.kontakt.sdk.android.ble.manager.ProximityManager;
const ProximityManagerContract = com.kontakt.sdk.android.ble.manager.ProximityManagerContract;
const ScanPeriod = com.kontakt.sdk.android.ble.configuration.ScanPeriod;
const ScanMode = com.kontakt.sdk.android.ble.configuration.scan.ScanMode;
const IBeaconListener = com.kontakt.sdk.android.ble.manager.listeners.IBeaconListener;
const OnServiceReadyListener = com.kontakt.sdk.android.ble.connection.OnServiceReadyListener;
const ProximitySDK = com.kontakt.sdk.android.common.Proximity;

export class BeaconDiscover {
    private proximityManager;
    private beacons: Array<Beacon> = [];
    private callback: (beacons: Beacon[]) => void;

    constructor(apiKey: string) {
        KontaktSDK.initialize(apiKey);

        this.proximityManager = new ProximityManager(application.android.foregroundActivity);
        this.proximityManager
            .configuration()
            .scanPeriod(ScanPeriod.RANGING)
            .scanMode(ScanMode.BALANCED);
    }

    public startListening(val: string) {
        let self = this;
        this.proximityManager.setIBeaconListener(
            new IBeaconListener({
                onIBeaconsUpdated: function(beacons, region) {
                    console.log('onIBeaconsUpdated', self.beacons);
                    self.pullBeacons(self.beacons);
                },
                onIBeaconDiscovered: function(beacon, region) {
                    if (!self.exist(new BeaconWrapper(beacon))) {
                        self.beacons.push(new BeaconWrapper(beacon));
                    }
                    console.log('onIBeaconDiscovered');
                },
                onIBeaconLost: function(beacon, region) {
                    self.remove(new BeaconWrapper(beacon));
                    self.pullBeacons(self.beacons);
                    console.log('onIBeaconLost');
                }
            })
        );
    }
    private exist(beacon: BeaconWrapper): boolean {
        let found = false;
        this.beacons.forEach(b => {
            if (b.address === beacon.address) {
                found = true;
            }
        });
        return found;
    }
    private remove(beacon: BeaconWrapper): void {
        this.beacons = this.beacons.filter(b => {
            return b.address !== beacon.address;
        });
    }
    public fetchBeacons(callback: (beacons: Beacon[]) => void) {
        this.callback = callback;
        if (this.proximityManager.isConnected()) {
            this.proximityManager.startScanning();
        } else {
            requestPermission(android.Manifest.permission.ACCESS_FINE_LOCATION, 'Needed to detect rooms').then(() => this.connect());
        }
    }

    public pullBeacons(beacons: Beacon[]) {
        if (this.callback) {
            this.callback(beacons);
        }
    }

    public stopFetching() {
        this.stopMonitoring();
    }

    private connect() {
        let self = this;
        this.proximityManager.connect(
            new OnServiceReadyListener({
                onServiceReady: function() {
                    console.log('onServiceReady - startScanning');
                    self.proximityManager.startScanning();
                }
            })
        );
    }

    private stopMonitoring() {
        if (this.proximityManager && this.proximityManager.isConnected()) {
            //this.proximityManager.stopMonitoring();
            this.proximityManager.disconnect();
        }
    }
}

class BeaconWrapper implements Beacon {
    private raw: any;

    constructor(raw) {
        this.raw = raw;
    }

    get uuid(): string {
        return this.raw
            .getProximityUUID()
            .toString()
            .toLowerCase();
    }
    get address(): string {
        return this.raw.getAddress();
    }
    get major(): string {
        return this.raw.getMajor();
    }

    get minor(): string {
        return this.raw.getMinor();
    }

    get description(): string {
        return this.raw.getName();
    }

    get proximity(): Proximity {
        var prox = this.raw.getProximity();
        if (prox === ProximitySDK.IMMEDIATE) {
            return Proximity.IMMEDIATE;
        } else if (prox === ProximitySDK.NEAR) {
            return Proximity.NEAR;
        } else if (prox === ProximitySDK.FAR) {
            return Proximity.FAR;
        } else {
            return Proximity.UNKNOWN;
        }
    }
}
