const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let phpProcess;
const PORT = 8000;

function startPhpServer() {
    const projectPath = path.join(__dirname, '..');
    
    phpProcess = spawn('php', ['artisan', 'serve', `--port=${PORT}`], {
        cwd: projectPath,
        shell: true
    });

    phpProcess.stdout.on('data', (data) => {
        console.log(`PHP Output: ${data}`);
    });

    phpProcess.stderr.on('data', (data) => {
        console.error(`PHP Error: ${data}`);
    });

    phpProcess.on('close', (code) => {
        console.log(`PHP server exited with code ${code}`);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "QueSystem - Desktop Application",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    setTimeout(() => {
        mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    }, 2000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    startPhpServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (phpProcess) {
        phpProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (phpProcess) {
        phpProcess.kill();
    }
});
