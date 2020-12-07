const { app, BrowserWindow, dialog, Menu } = require("electron");
const createApplicationMenu = require("./application-menu");
const fs = require("fs");
const windows = new Set();
const openFiles = new Map();

app.on("ready", () => {
  createApplicationMenu();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") {
    return false;
  }
});

// 当没有窗口打开，用户点击dock栏的图标，直接新建一个窗口
app.on("activate", (event, hasVisiableWindows) => {
  if (!hasVisiableWindows) createWindow();
});

const createWindow = (exports.createWindow = () => {
  // 处理新开的窗口位置前后问题
  let x, y;
  const currentWindow = BrowserWindow.getFocusedWindow();
  if (currentWindow) {
    const [currentWindowX, currentWindowY] = currentWindow.getPosition();
    x = currentWindowX + 10;
    y = currentWindowY + 10;
  }
  let newWindow = new BrowserWindow({
    x,
    y,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  newWindow.loadFile("app/index.html");

  newWindow.once("ready-to-show", () => {
    newWindow.show();
    // newWindow.webContents.openDevTools();
  });
  newWindow.on("focus", createApplicationMenu);

  newWindow.on("close", (event) => {
    if (newWindow.isDocumentEdited()) {
      event.preventDefault();
      dialog
        .showMessageBox(newWindow, {
          type: "warning",
          title: "Quit with Unsaved Changes?",
          message: "Your changes will be lost if you do not save.",
          buttons: ["Quit Anyway", "Cancel"],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          console.log(result, "which");
          if (result.response === 0) {
            newWindow.destroy();
          }
        })
        .catch((err) => {});
    }
  });
  newWindow.on("closed", () => {
    windows.delete(newWindow);
    createApplicationMenu();
    newWindow = null;
  });

  windows.add(newWindow);
  return newWindow;
});

const startWatchingFile = (targetWindow, file) => {
  stopWatchingFile(targetWindow);
  const watcher = fs.watchFile(file, () => {
    const content = fs.readFileSync(file).toString();
    targetWindow.webContents.send("file-changed", file, content);
  });
  openFiles.set(targetWindow, watcher);
};

const stopWatchingFile = (targetWindow) => {
  if (openFiles.has(targetWindow)) {
    openFiles.get(targetWindow).stop();
    openFiles.delete(targetWindow);
  }
};

// 不仅在当前process使用，也将其导出到render process 使用
const openFile = (exports.openFile = (targetWindow, file) => {
  const content = fs.readFileSync(file).toString();
  app.addRecentDocument(file);
  targetWindow.setRepresentedFilename(file);
  console.log(file, content, "又没有值2");
  targetWindow.webContents.send("file-opened", file, content);
  startWatchingFile(targetWindow, file);
  createApplicationMenu();
});

exports.saveHtml = (targetWindow, contnet) => {
  dialog
    .showSaveDialog(targetWindow, {
      title: "Save HTML",
      defaultPath: app.getPath("documents"),
      filters: [
        {
          name: "HTML Files",
          extensions: ["html", "htm"],
        },
      ],
    })
    .then((file) => {
      console.log(file, "sfffff");
      if (!file) return;
      fs.writeFileSync(file, contnet);
    })
    .catch((err) => {});
};

exports.saveMarkdown = (targetWindow, file, content) => {
  console.log(file, "filefilefile");
  // 当文件不存在的时候，先新建一个并保存
  if (!file) {
    console.log(file, "wwowo");
    dialog
      .showSaveDialog(targetWindow, {
        title: "Save Markdown",
        defaultPath: app.getPath("documents"),
        filters: [
          {
            name: "MarkDown Files",
            extensions: ["md", "markdown"],
          },
        ],
      })
      .then((res) => {
        const file = res.filePath;
        console.log(file, content, "bucpzl");
        if (!file) return;
        fs.writeFileSync(file, content);
        openFile(targetWindow, file);
      })
      .catch((err) => {});
  } else {
    // 有的话直接写入
    fs.writeFileSync(file, content);
    openFile(targetWindow, file);
  }
};

exports.getFileFromUser = (targetWindow) => {
  dialog
    .showOpenDialog(targetWindow, {
      properties: ["openFile"],
      filters: [
        {
          name: "Markdown Files",
          extensions: ["md", "markdown"],
        },
        { name: "Text Files", extensions: ["txt"] },
      ],
    })
    .then((files) => {
      const file = files.filePaths;
      if (file) {
        openFile(targetWindow, file[0]);
      }
    })
    .catch((err) => {
      console.log(err, "eroor occer");
    });
};
