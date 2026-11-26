import { app, dialog } from 'electron';
import pkg from 'electron-updater'; // CJS package, so default import under ESM
const { autoUpdater } = pkg;

export function initAutoUpdater() {
  if (!app.isPackaged) return; // never runs in `npm run dev`

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => console.error('[updater]', err?.message ?? err));

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      title: 'Update ready',
      message: `Kiln ${info.version} has been downloaded.`,
      detail: 'Restart to finish updating.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  const check = () => autoUpdater.checkForUpdates().catch((e) => console.error('[updater]', e?.message ?? e));
  check();
  setInterval(check, 4 * 60 * 60 * 1000); // re-check every 4 hours
}