# Youdao Panel Dictionary

一个适用于 Ubuntu 24.04 GNOME 46 的顶栏查词扩展。它把一个搜索框放进 GNOME 顶栏，输入英文单词或中文词语后自动弹出释义，并可播放英音、美音发音。

A top-bar dictionary extension for Ubuntu 24.04 GNOME 46. It puts a search box in the GNOME top bar, shows definitions automatically as you type an English word or a Chinese phrase, and plays British or American pronunciations.

## 功能 / Features

- 顶栏内嵌搜索框，输入停顿 0.4 秒后自动查询并弹出释义
  An embedded top-bar search box that looks up and shows definitions automatically after a 0.4-second pause in typing
- 按回车立即查询，并自动播放美音
  Press Enter to look up immediately and play the American pronunciation automatically
- 在搜索框上点击右键，直接粘贴剪贴板内容、立即查询并播放美音
  Right-click the search box to paste the clipboard, look it up immediately, and play the American pronunciation
- 英译中：显示英音、美音音标和详细中文释义
  English to Chinese: shows British and American phonetics with detailed Chinese definitions
- 中译英：显示拼音和带词性的英文译词，每个译词附简短中文释义以区分义项；发音读第一个英文译词
  Chinese to English: shows pinyin and English translations with parts of speech, each followed by a short Chinese gloss to tell senses apart; pronunciation reads the first English translation
- 标准词典没有收录时，回退到有道专业网络释义，适合 PyTorch、ROS、SLAM、RAG 等新术语
  Falls back to Youdao web definitions when the standard dictionary has no entry, useful for new terms such as PyTorch, ROS, SLAM, and RAG
- 结果弹窗中的英音、美音播放按钮
  British and American pronunciation buttons in the results popup
- 搜索框已有单词时，左键点击即重新查询
  Left-clicking the search box looks up its current word again
- 查询请求可取消，扩展禁用时会停止网络请求和音频进程
  Lookups can be cancelled, and disabling the extension stops network requests and audio processes
- 不需要 App Key，适合个人使用
  No App Key required; intended for personal use

## 兼容性 / Compatibility

- GNOME Shell 46（Ubuntu 24.04）
  GNOME Shell 46 (Ubuntu 24.04)
- 需要 `curl` 和 `gst-play-1.0` 才能播放发音
  `curl` and `gst-play-1.0` are required for pronunciation playback

当前版本使用 GNOME 45 起的 ESM 扩展 API 和 libsoup 3。GNOME 42（Ubuntu 22.04）请使用 `main` 分支的旧版本。

This version uses the ESM extension API introduced in GNOME 45 and libsoup 3. For GNOME 42 (Ubuntu 22.04), use the legacy version on the `main` branch.

## 安装 / Installation

```bash
sudo apt install curl gstreamer1.0-tools
gnome-extensions pack --force --out-dir /tmp ./
gnome-extensions install --force /tmp/youdao-panel-dictionary@local.shell-extension.zip
gnome-extensions enable youdao-panel-dictionary@local
```

如果扩展没有马上出现在顶栏，在 X11 会话中按 `Alt+F2`，输入 `r` 并回车，重载 GNOME Shell；Wayland 会话需要注销后重新登录。

If the extension does not appear in the top bar right away, press `Alt+F2` in an X11 session, type `r`, and press Enter to reload GNOME Shell; in a Wayland session, log out and log back in.

## 使用 / Usage

1. 点击顶栏中的搜索框。
   Click the search box in the top bar.
2. 输入英文单词或中文词语，稍作停顿即自动弹出释义；也可以按回车立即查询并播放美音。
   Type an English word or a Chinese phrase and pause briefly to see the definition, or press Enter to look it up immediately and play the American pronunciation.
3. 想查剪贴板里的词时，在搜索框上点击右键即可。
   To look up the word in your clipboard, right-click the search box.
4. 在弹出的结果中查看音标和释义，点击“英音”或“美音”播放发音。
   Read the phonetics and definitions in the popup, and click “英音” (British) or “美音” (American) to play a pronunciation.

## 工作方式 / How It Works

扩展继承 `PanelMenu.Button`，通过 `Main.panel.addToStatusArea()` 注册到 GNOME 顶栏。查词请求通过 libsoup 3 发送，使用有道公开的 `jsonapi` 接口：英文查询读取其中的 `ec` 英汉词典结果，中文查询读取 `ce` 汉英词典结果；若标准词典没有结果，则使用 `web_trans` 专业网络释义回退。发音地址由 `dictvoice` 接口提供，先用 `curl` 下载到用户缓存目录，再交给 GStreamer 播放。

The extension subclasses `PanelMenu.Button` and registers itself in the GNOME top bar with `Main.panel.addToStatusArea()`. Lookups are sent with libsoup 3 and use Youdao's public `jsonapi` endpoint: English queries read its `ec` (English–Chinese) results, and Chinese queries read its `ce` (Chinese–English) results; when the standard dictionary has nothing, it falls back to the `web_trans` web definitions. Pronunciation audio comes from the `dictvoice` endpoint; it is downloaded with `curl` into the user cache directory and then played with GStreamer.

查词需要联网，查询的词语会发送到有道服务器。有道公开端点不是正式 OpenAPI 的稳定性承诺，接口或访问策略变化时可能需要更新实现。不要将它用于高可靠生产服务。

Lookups require an internet connection, and the words you look up are sent to Youdao's servers. Youdao's public endpoints are not a stable, officially supported OpenAPI; the implementation may need updates if the endpoints or access policies change. Do not rely on it for high-reliability production services.

## 开发 / Development

源码位于 `extension.js`，顶栏和弹层样式位于 `stylesheet.css`，扩展声明位于 `metadata.json`。修改后重新打包并重载 GNOME Shell 即可测试：

The source code is in `extension.js`, top-bar and popup styles are in `stylesheet.css`, and the extension manifest is in `metadata.json`. After making changes, repack the extension and reload GNOME Shell to test:

```bash
gnome-extensions pack --force --out-dir /tmp ./
gnome-extensions install --force /tmp/youdao-panel-dictionary@local.shell-extension.zip
```

## License

本项目未附带额外许可证。使用有道服务时请遵守有道的服务条款和适用法律。

This project does not include a separate license. When using Youdao services, follow Youdao's terms of service and applicable laws.
