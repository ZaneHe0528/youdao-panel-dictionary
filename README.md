# Youdao Panel Dictionary

一个适用于 Ubuntu GNOME 42 的顶栏查词扩展。它把一个横向搜索框放进 GNOME 状态栏，输入单词后按回车即可查看英音、美音音标和详细中文释义，并可播放对应发音。

## 功能

- 顶栏内嵌搜索框，支持直接输入和回车查询
- 搜索框已有单词时，鼠标点击即自动查询并显示释义
- 显示输入的单词、英音音标、美音音标和详细中文释义
- 标准词典没有收录时，回退到有道专业网络释义，适合 PyTorch、ROS、SLAM、RAG 等新术语
- 英音、美音播放按钮
- 查询请求可取消，扩展禁用时会停止网络请求和音频进程
- 不需要 App Key，适合个人使用

## 兼容性

- GNOME Shell 42
- Ubuntu 22.04 风格的 GNOME Shell X11 会话
- 需要 `curl` 和 `gst-play-1.0` 才能播放发音

当前版本使用 GNOME Shell 42 的旧式 JavaScript API。GNOME 45 及更高版本改用了新的扩展 API，需要单独迁移，不能直接复用本版本。

## 安装

```bash
sudo apt install curl gstreamer1.0-tools
gnome-extensions pack --force --out-dir /tmp ./
gnome-extensions install --force /tmp/youdao-panel-dictionary@local.shell-extension.zip
gnome-extensions enable youdao-panel-dictionary@local
```

如果扩展没有马上出现在顶栏，在 X11 会话中按 `Alt+F2`，输入 `r` 并回车，重载 GNOME Shell。

## 使用

1. 点击顶栏中的搜索框。
2. 输入英文单词并按回车。
3. 在弹出的结果菜单中查看音标和详细释义，点击“英音”或“美音”播放发音。

搜索框中已有单词时，之后只需再次点击搜索框，无需按回车也会自动查询并打开结果。

## 工作方式

扩展继承 `PanelMenu.Button`，通过 `Main.panel.addToStatusArea()` 注册到 GNOME 顶栏。查词请求使用有道公开的 `jsonapi` 接口，优先读取词典音标和详细释义；若标准词典没有结果，则使用其中的 `web_trans` 专业网络释义回退。发音地址由 `dictvoice` 接口提供，先用 `curl` 下载到用户缓存目录，再交给 GStreamer 播放。

有道公开端点不是正式 OpenAPI 的稳定性承诺，接口或访问策略变化时可能需要更新实现。不要将它用于高可靠生产服务。

## 开发

源码位于 `extension.js`，顶栏和弹层样式位于 `stylesheet.css`，扩展声明位于 `metadata.json`。修改后重新打包并重载 GNOME Shell 即可测试：

```bash
gnome-extensions pack --force --out-dir /tmp ./
gnome-extensions install --force /tmp/youdao-panel-dictionary@local.shell-extension.zip
```

## License

本项目未附带额外许可证。使用有道服务时请遵守有道的服务条款和适用法律。
