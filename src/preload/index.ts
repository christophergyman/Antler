import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  fetchGitHubIssues: () => ipcRenderer.invoke("github:fetch-issues"),
  getCards: () => ipcRenderer.invoke("cards:get"),
  reloadConfig: () => ipcRenderer.invoke("config:reload"),
});
