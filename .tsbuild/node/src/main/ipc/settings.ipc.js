import { ipcMain } from 'electron';
import { getSettings, setDockSide } from '../settingsStore';
export function registerSettingsIpc(onDockSideChange) {
    ipcMain.handle('settings:get', () => getSettings());
    ipcMain.handle('settings:setDockSide', (_event, dockSide) => {
        const updated = setDockSide(dockSide);
        onDockSideChange(updated.dockSide);
        return updated;
    });
}
