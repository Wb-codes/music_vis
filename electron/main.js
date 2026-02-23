const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, session } = require('electron');
const path = require('path');

let SpoutOutput = null;
let spoutAvailable = false;
try {
  const spoutModule = require('electron-spout');
  SpoutOutput = spoutModule.SpoutOutput;
  spoutAvailable = true;
  console.log('Spout module loaded successfully');
} catch (e) {
  console.warn('Spout not available:', e.message);
  console.warn('To enable Spout output:');
  console.warn('1. Install CMake from https://cmake.org/download/');
  console.warn('2. Install Visual Studio Build Tools with C++ development');
  console.warn('3. Run: npm run rebuild-spout');
}

let mainWindow = null;
let spoutWindow = null;
let spoutSender = null;
let spoutEnabled = false;
let spoutSenderName = 'Music Visualizer';
let hasShownSpoutDialog = false;
let paintCount = 0;
let lastFrameTime = 0;
let texturePathCount = 0;
let bitmapPathCount = 0;
let frameSkip = 0;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (spoutWindow) {
      spoutWindow.close();
    }
  });
}

async function createSpoutWindow(resolution = '1080p') {
  if (spoutWindow) return;

  console.log('Creating spout window...');

  // Set resolution based on setting
  const width = resolution === '720p' ? 1280 : 1920;
  const height = resolution === '720p' ? 720 : 1080;
  console.log(`Spout resolution: ${width}x${height}`);

  spoutWindow = new BrowserWindow({
    show: false,
    width: width,
    height: height,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true,
      offscreenUseSharedTexture: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });

  spoutWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[Spout Window]', message);
  });

  await spoutWindow.loadFile('spout-output.html');
  console.log('Spout window loaded');

  spoutWindow.webContents.setFrameRate(60);
  spoutWindow.webContents.startPainting();
  console.log('Spout window painting started');

  spoutWindow.webContents.on('paint', (event, dirty, image, texture) => {
    paintCount++;
    
    // Log which transfer method is being used every 60 frames
    if (paintCount % 60 === 0) {
      const totalFrames = texturePathCount + bitmapPathCount;
      const texturePercent = totalFrames > 0 ? ((texturePathCount / totalFrames) * 100).toFixed(1) : 0;
      console.log(`Spout paint #${paintCount} - Texture: ${texturePathCount}, Bitmap: ${bitmapPathCount} (${texturePercent}% texture)`);
    }
    
    if (!spoutSender || !spoutEnabled) return;
    
    try {
      // Frame pacing - skip frames if needed
      if (frameSkip > 0) {
        if (paintCount % (frameSkip + 1) !== 0) {
          return; // Skip this frame
        }
      }
      
      if (texture) {
        // Fast path: GPU texture sharing (zero-copy)
        texturePathCount++;
        spoutSender.updateTexture(texture);
      } else if (image) {
        // Slow path: CPU bitmap (causes latency)
        bitmapPathCount++;
        const size = image.getSize();
        spoutSender.updateFrame(image.getBitmap(), size);
      }
    } catch (err) {
      console.error('Spout update error:', err);
    }
  });

  spoutWindow.webContents.on('did-finish-load', () => {
    console.log('Spout window finished loading, starting painting');
    spoutWindow.webContents.invalidate();
  });
  
  spoutWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Spout render process gone:', details);
  });
}

function destroySpoutWindow() {
  if (spoutWindow) {
    spoutWindow.close();
    spoutWindow = null;
  }
  spoutSender = null;
}

function updateSpoutSenderName(name) {
  spoutSenderName = name;
  if (spoutEnabled && spoutSender) {
    try {
      spoutSender.name = name;
    } catch (err) {
      console.error('Spout name update error:', err);
    }
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });
  
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

ipcMain.handle('spout:check-available', () => {
  return spoutAvailable;
});

  ipcMain.handle('spout:enable', async (event, options = {}) => {
    if (!spoutAvailable) {
      if (!hasShownSpoutDialog && mainWindow) {
        hasShownSpoutDialog = true;
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Spout Not Available',
          message: 'Spout output is not available.',
          detail: 'To enable Spout:\\n\\n1. Install CMake from https://cmake.org/download/\\n2. Install Visual Studio Build Tools with C++ development\\n3. Run: npm run rebuild-spout\\n\\nAlternatively, use OBS with its Spout plugin to capture the window.',
          buttons: ['OK']
        });
      }
      return { success: false, error: 'Spout not available - native module not compiled' };
    }

    try {
      // Get resolution from options
      const resolution = options.resolution || '1080p';
      await createSpoutWindow(resolution);
      spoutSender = new SpoutOutput(spoutSenderName);
      spoutEnabled = true;
      console.log('Spout sender created:', spoutSenderName, 'at', resolution);

      // Request current scene from main window
      mainWindow.webContents.send('spout:request-scene');

      if (mainWindow) {
        mainWindow.webContents.send('spout:status-changed', true);
      }
      return { success: true };
    } catch (e) {
      console.error('Spout enable error:', e);
      return { success: false, error: e.message };
    }
  });

ipcMain.handle('spout:disable', () => {
  spoutEnabled = false;
  destroySpoutWindow();
  
  if (mainWindow) {
    mainWindow.webContents.send('spout:status-changed', false);
  }
  return { success: true };
});

ipcMain.handle('spout:get-status', () => {
  return spoutEnabled;
});

ipcMain.handle('spout:update-name', (event, name) => {
  updateSpoutSenderName(name);
  return { success: true };
});

ipcMain.handle('spout:update-frame-skip', (event, skip) => {
  frameSkip = skip;
  console.log('Spout frame skip updated:', skip);
  return { success: true };
});

ipcMain.handle('audio:get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL()
    }));
  } catch (err) {
    console.error('Failed to get audio sources:', err);
    return [];
  }
});

ipcMain.on('sync:settings', (event, settings) => {
  if (spoutWindow) {
    spoutWindow.webContents.send('sync:settings', settings);
  }
});

ipcMain.on('sync:audio', (event, audioData) => {
  if (spoutWindow) {
    spoutWindow.webContents.send('sync:audio', audioData);
  }
});

ipcMain.on('sync:scene', (event, sceneType) => {
  if (spoutWindow) {
    spoutWindow.webContents.send('sync:scene', sceneType);
  }
});

ipcMain.on('sync:time', (event, elapsedTime) => {
  if (spoutWindow) {
    spoutWindow.webContents.send('sync:time', elapsedTime);
  }
});
