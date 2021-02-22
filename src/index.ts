import { app, BrowserWindow, ipcMain } from "electron";
import fs from "fs";
import IPFS from "ipfs-core";
import Protector from "libp2p/src/pnet";

import {
  getAuthenticationURL,
  getLogOutUrl,
  loadTokens,
  logout,
  refreshTokens,
} from "./services/auth-service";

import "./ipcMain/wallet";
import "./ipcMain/account";
import "./ipcMain/ipfs";

declare const MAIN_WINDOW_WEBPACK_ENTRY: any;

let mainWindow: BrowserWindow | null = null;
let authWindow: BrowserWindow | null = null;
export let node: any;

const BOOTSTRAP_ADDRESSS =
  "/ip4/15.164.229.6/tcp/4001/ipfs/12D3KooWNubmXubMPzPY9B69HLAEpoRBS41MchdGCa9SgJtd5LnT";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 850,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (process.env.NODE_ENV === "development") {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on("did-finish-load", async () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }

    try {
      node = await IPFS.create({
        libp2p: {
          modules: {
            connProtector: new Protector(
              fs.readFileSync("./src/assets/swarm.key")
            ),
          },
        },
        config: {
          Bootstrap: [BOOTSTRAP_ADDRESSS],
        },
      });
    } catch (error) {
      console.log(error);
    }

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();

      if (authWindow) {
        destroyAuthWin();
      }
    }
  });
};

function destroyAuthWin() {
  if (!authWindow) return;
  authWindow.close();
  authWindow = null;
}

function createAuthWindow() {
  if (mainWindow) {
    mainWindow.close();
  }

  authWindow = new BrowserWindow({
    width: 1024,
    height: 728,
    webPreferences: {
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  authWindow.loadURL(getAuthenticationURL(), { userAgent: "Chrome" });

  const {
    session: { webRequest },
  } = authWindow.webContents;

  const filter = {
    urls: ["http://localhost/callback*"],
  };

  webRequest.onBeforeRequest(filter, async ({ url }) => {
    await loadTokens(url);
    return createWindow();
  });
}

async function showWindow() {
  try {
    await refreshTokens();
    return createWindow();
  } catch (err) {
    return createAuthWindow();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", showWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    showWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
ipcMain.handle("logout", async () => {
  const logoutWindow = new BrowserWindow({
    show: false,
  });

  logoutWindow.loadURL(getLogOutUrl());

  logoutWindow.on("ready-to-show", async () => {
    logoutWindow.close();
    await logout();
  });

  if (mainWindow) {
    mainWindow.close();
  }
});
