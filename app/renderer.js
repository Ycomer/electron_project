const { remote, ipcRenderer, shell } = require("electron");
const { Menu } = remote; //一定要从mainProcess 拿出来Menu
const mainProcess = remote.require("./main.js");
const currenWindow = remote.getCurrentWindow();
const marked = require("marked");
const path = require("path");

const markdownView = document.querySelector("#markdown");
const htmlView = document.querySelector("#html");
const newFileButton = document.querySelector("#new-file");
const openFileButton = document.querySelector("#open-file");
const saveMarkdownButton = document.querySelector("#save-markdown");
const revertButton = document.querySelector("#revert");
const saveHtmlButton = document.querySelector("#save-html");
const showFileButton = document.querySelector("#show-file");
const openInDefaultButton = document.querySelector("#open-in-default");

let filePath = null;
let originalContent = "";

const isDifferentContent = (content) => content !== markdownView.value;

const updateUserInputface = (isEdited) => {
  let title = "Fire Sale";
  if (filePath) {
    title = `${path.basename(filePath)} - ${title}`;
  }
  if (isEdited) {
    title = `${title}(Edited)`;
  }
  currenWindow.setTitle(title);
  currenWindow.setDocumentEdited(isEdited);

  revertButton.disabled = !isEdited;
  saveMarkdownButton.disabled = !isEdited;
};
// 添加拖拽

document.addEventListener("dragstart", (event) => event.preventDefault());
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("dragleave", (event) => event.preventDefault());
document.addEventListener("drop", (event) => event.preventDefault());

const getDraggedFile = (event) => event.dataTransfer.items[0];
const getDroppedFile = (event) => event.dataTransfer.files[0];

const fileTypeIsSupported = (file) => {
  return ["text/plain", "text/markdown"].includes(file.type);
};

const renderMarkdownToHtml = (markdown) => {
  htmlView.innerHTML = marked(markdown, { sanitize: true });
};

// 在系统中显示文件
const showFile = () => {
  if (!filePath) {
    return alert("This file has not been saved to the filesystem");
  }
  shell.showItemInFolder(filePath);
};
// 在默认的文件中打开

const openInDefaultApplication = () => {
  if (!filePath) {
    return alert("This file has not been saved to the file system.");
  }
  shell.openPath(filePath);
};

markdownView.addEventListener("keyup", (event) => {
  const currentContent = event.target.value;
  renderMarkdownToHtml(currentContent);
  updateUserInputface(currentContent !== originalContent);
});

markdownView.addEventListener("dragover", (event) => {
  const file = getDraggedFile(event);
  if (fileTypeIsSupported(file)) {
    markdownView.classList.add("drag-over");
  } else {
    markdownView.classList.add("drag-error");
  }
});

// 将拖进来的文件打开

markdownView.addEventListener("dragleave", () => {
  markdownView.classList.remove("drag-over");
  markdownView.classList.remove("drag-error");
});

markdownView.addEventListener("drop", (event) => {
  const file = getDraggedFile(event);
  if (fileTypeIsSupported(file)) {
    mainProcess.openFile(currenWindow, file.path);
  } else {
    alert("That file type is not supported");
  }
  markdownView.classList.remove("drag-over");
  markdownView.classList.remove("drag-error");
});

newFileButton.addEventListener("click", () => {
  mainProcess.createWindow();
});

openFileButton.addEventListener("click", () => {
  mainProcess.getFileFromUser(currenWindow);
});

saveHtmlButton.addEventListener("click", () => {
  mainProcess.saveHtml(currenWindow, htmlView.innerHTML);
});

saveMarkdownButton.addEventListener("click", () => {
  mainProcess.saveMarkdown(currenWindow, filePath, markdownView.value);
});

revertButton.addEventListener("click", () => {
  markdownView.value = originalContent;
  renderMarkdownToHtml(originalContent);
});

showFileButton.addEventListener("click", showFile);
openInDefaultButton.addEventListener("click", openInDefaultApplication);

// 渲染文件的逻辑领出来
const renderFile = (file, contnet) => {
  console.log(file, contnet, "又没有值1");
  filePath = file;
  originalContent = contnet;

  markdownView.value = contnet;
  renderMarkdownToHtml(contnet);

  showFileButton.disabled = false;
  openInDefaultButton.disabled = false;

  updateUserInputface(false);
};

ipcRenderer.on("show-file", showFile);

ipcRenderer.on("open-in-default", openInDefaultApplication);

ipcRenderer.on("file-opened", (event, file, content) => {
  console.log(file, content, "又没有值3");
  if (currenWindow.isDocumentEdited() && isDifferentContent(content)) {
    remote.dialog
      .showMessageBox(newWindow, {
        type: "warning",
        title: "Overwrite Current Unsaved Changes?",
        message:
          "Open a new file in this window will overwrite your unsaved changes, Open this file anyway?",
        buttons: ["Yes", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 1) {
          return;
        }
      })
      .catch((err) => {});
  }
  renderFile(file, content);
});

ipcRenderer.on("file-changed", (event, file, content) => {
  if (!isDifferentContent(content)) return;
  remote.dialog
    .showMessageBox(newWindow, {
      type: "warning",
      title: "Overwrite Current Unsaved Changes?",
      message: "Another application has changed this file, Load changes?",
      buttons: ["Yes", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {})
    .catch((err) => {});
  renderFile(file, content);
});

// 跟随鼠标的菜单
const createContextMenu = () => {
  return Menu.buildFromTemplate([
    {
      label: "Open File",
      click() {
        mainProcess.getFileFromUser();
      },
    },
    {
      label: "Show File in Folder",
      click: showFile,
      enabled: !!filePath,
    },
    {
      label: "Open in Default Editor",
      click: openInDefaultApplication,
      enabled: !!filePath, //在当前窗口中是否有已经加载的文件
    },
    { type: "separator" },
    {
      label: "Cut",
      role: "cut",
    },
    {
      label: "Copy",
      role: "copy",
    },
    {
      label: "Paste",
      role: "paste",
    },
    {
      label: "Select All",
      role: "selectAll",
    },
  ]);
};

markdownView.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  createContextMenu().popup();
});

ipcRenderer.on("save-markdowm", () => {
  mainProcess.saveMarkdown(currenWindow, filePath, markdownView.value);
});

ipcRenderer.on("save-html", () => {
  mainProcess.saveHtml(currenWindow, htmlView.innerHTML);
});
