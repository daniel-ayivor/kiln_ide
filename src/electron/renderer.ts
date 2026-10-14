export interface ElectronAPI {
  setTitle: (title: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}



// 1. Cast elements to their specific HTML types so TypeScript knows .value exists
const setButton = document.getElementById('btn') as HTMLButtonElement | null;
const titleInput = document.getElementById('title') as HTMLInputElement | null;

// 2. Use optional chaining (?.) to prevent the app from crashing if elements are missing
setButton?.addEventListener('click', (): void => {
  if (titleInput) {
    const title: string = titleInput.value;
    
    // 3. Call your Electron API channel
    window.electronAPI.setTitle(title);
  }
});
