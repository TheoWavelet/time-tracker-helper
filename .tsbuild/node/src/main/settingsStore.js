import Store from 'electron-store';
const defaults = {
    dockSide: 'right',
    dockYOffset: null
};
const store = new Store({ defaults });
export function getSettings() {
    return { dockSide: store.get('dockSide'), dockYOffset: store.get('dockYOffset') };
}
export function setDockSide(dockSide) {
    store.set('dockSide', dockSide);
    return getSettings();
}
export function setDockYOffset(dockYOffset) {
    store.set('dockYOffset', dockYOffset);
    return getSettings();
}
