const {Clutter, Gio, GLib, GObject, Soup, St} = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const LOOKUP_URL = 'https://dict.youdao.com/jsonapi?q=';
const VOICE_URL = 'https://dict.youdao.com/dictvoice?audio=';

const YoudaoPanelDictionary = GObject.registerClass(
class YoudaoPanelDictionary extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Youdao Panel Dictionary', true);

        this._destroyed = false;
        this._pendingMessage = null;
        this._clickLookupId = null;
        this._focusEntryId = null;
        this._stageCapturedEventId = null;
        this._focusWindowId = null;
        this._downloadProcess = null;
        this._audioProcess = null;
        this._session = new Soup.Session();
        this._audioPath = GLib.build_filenamev([
            GLib.get_user_cache_dir(),
            'youdao-panel-dictionary.mp3',
        ]);

        this._resultsMenu = new PopupMenu.PopupMenu(this, 0.0, St.Side.TOP, 0);
        this._resultsMenu.actor.add_style_class_name('panel-menu');
        Main.uiGroup.add_actor(this._resultsMenu.actor);
        this._resultsMenu.actor.hide();
        this._stageCapturedEventId = global.stage.connect('captured-event', (_stage, event) => {
            if (this._destroyed || !this._resultsMenu.isOpen)
                return Clutter.EVENT_PROPAGATE;

            const eventType = event.type();
            if (eventType !== Clutter.EventType.BUTTON_PRESS &&
                eventType !== Clutter.EventType.TOUCH_BEGIN)
                return Clutter.EVENT_PROPAGATE;

            const target = global.stage.get_event_actor(event);
            const inEntry = target && (target === this._entry || this._entry.contains(target));
            const inResults = target && (target === this._resultsMenu.actor ||
                this._resultsMenu.actor.contains(target));
            if (!inEntry && !inResults)
                this._resultsMenu.close();

            return Clutter.EVENT_PROPAGATE;
        });
        this._focusWindowId = global.display.connect('notify::focus-window', () => {
            if (!this._destroyed && this._resultsMenu.isOpen)
                this._resultsMenu.close();
        });

        this._entry = new St.Entry({
            style_class: 'youdao-search-entry',
            hint_text: '有道查词',
            can_focus: true,
            track_hover: true,
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const entryText = this._entry.get_clutter_text();
        entryText.connect('activate', () => this._lookup());
        entryText.connect('button-release-event', () => {
            if (this._clickLookupId)
                GLib.source_remove(this._clickLookupId);
            this._clickLookupId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._clickLookupId = null;
                if (!this._destroyed)
                    this._lookup();
                return GLib.SOURCE_REMOVE;
            });
            return Clutter.EVENT_PROPAGATE;
        });
        this.add_child(this._entry);

        this._resultItem = new PopupMenu.PopupMenuItem('输入单词后按回车', {
            reactive: false,
            can_focus: false,
        });
        this._resultItem.add_style_class_name('youdao-result-item');
        this._resultItem.label.get_clutter_text().set_line_wrap(true);
        this._resultsMenu.addMenuItem(this._resultItem);

        const audioItem = new PopupMenu.PopupBaseMenuItem({reactive: true});
        audioItem.add_child(this._makeAudioButton('英音', 1));
        audioItem.add_child(this._makeAudioButton('美音', 2));
        this._resultsMenu.addMenuItem(audioItem);
    }

    _makeAudioButton(label, type) {
        const content = new St.BoxLayout({style_class: 'youdao-audio-content'});
        content.add_child(new St.Icon({
            icon_name: 'audio-volume-high-symbolic',
            style_class: 'popup-menu-icon',
        }));
        content.add_child(new St.Label({text: label, y_align: Clutter.ActorAlign.CENTER}));

        const button = new St.Button({
            child: content,
            style_class: 'youdao-audio-button',
            can_focus: true,
            x_expand: true,
            accessible_name: `播放${label}`,
        });
        button.connect('clicked', () => this._play(type));
        return button;
    }

    _lookup() {
        const query = this._entry.get_text().trim();
        if (!query)
            return;

        if (this._pendingMessage)
            this._session.cancel_message(this._pendingMessage, Soup.Status.CANCELLED);

        this._resultItem.label.set_text('查询中...');
        this._resultsMenu.open();
        if (this._focusEntryId)
            GLib.source_remove(this._focusEntryId);
        this._focusEntryId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._focusEntryId = null;
            if (!this._destroyed)
                global.stage.set_key_focus(this._entry.get_clutter_text());
            return GLib.SOURCE_REMOVE;
        });

        const message = Soup.Message.new('GET', LOOKUP_URL + encodeURIComponent(query));
        this._pendingMessage = message;
        this._session.queue_message(message, (_session, response) => {
            if (this._destroyed || response !== this._pendingMessage)
                return;

            this._pendingMessage = null;
            if (response.status_code !== Soup.Status.OK) {
                this._resultItem.label.set_text('查询失败，请检查网络');
                return;
            }

            try {
                const payload = JSON.parse(response.response_body.data);
                const entry = payload.ec?.word?.[0];
                const phonetics = [];
                if (entry?.ukphone)
                    phonetics.push(`英 /${entry.ukphone}/`);
                if (entry?.usphone)
                    phonetics.push(`美 /${entry.usphone}/`);

                const pronunciation = phonetics.join('    ') || '未找到音标';
                const meanings = [];
                for (const translation of (entry?.trs ?? [])) {
                    for (const item of (translation.tr ?? [])) {
                        const values = item.l?.i;
                        if (Array.isArray(values))
                            values.forEach(value => meanings.push(value));
                        else if (values)
                            meanings.push(values);
                    }
                }

                let networkFallback = false;
                if (!meanings.length) {
                    networkFallback = true;
                    const translations = payload.web_trans?.['web-translation'] ?? [];
                    for (const webResult of translations) {
                        for (const translation of (webResult.trans ?? [])) {
                            const value = translation.value;
                            const summary = (translation.summary?.line?.[0] ?? '')
                                .replace(/<[^>]*>/g, '')
                                .replace(/&nbsp;/g, ' ')
                                .trim();
                            const detail = value && summary
                                ? `${value}: ${summary}`
                                : (value || summary);
                            if (detail)
                                meanings.push(detail);
                            if (meanings.length >= 5)
                                break;
                        }
                        if (meanings.length >= 5)
                            break;
                    }
                }

                const definitionText = meanings.length
                    ? `${networkFallback ? '专业网络释义：\n' : ''}${meanings.map((meaning, index) => `${index + 1}. ${meaning}`).join('\n')}`
                    : '未找到中文释义';
                this._resultItem.label.set_text(`${query}\n${pronunciation}\n\n${definitionText}`);
            } catch (_error) {
                this._resultItem.label.set_text('有道返回了无法识别的结果');
            }
        });
    }

    _play(type) {
        const query = this._entry.get_text().trim();
        if (!query)
            return;

        if (this._audioProcess)
            this._audioProcess.force_exit();
        if (this._downloadProcess)
            this._downloadProcess.force_exit();

        const uri = `${VOICE_URL}${encodeURIComponent(query)}&type=${type}`;
        try {
            const download = Gio.Subprocess.new(
                ['curl', '-fsSL', '--max-time', '10', '-A', 'Mozilla/5.0',
                    uri, '-o', this._audioPath],
                Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
            );
            this._downloadProcess = download;
            download.wait_async(null, (process, result) => {
                try {
                    process.wait_finish(result);
                } catch (_error) {}

                if (this._destroyed || this._downloadProcess !== process)
                    return;

                this._downloadProcess = null;
                if (!process.get_successful()) {
                    this._resultItem.label.set_text('发音下载失败');
                    this._resultsMenu.open();
                    return;
                }

                this._audioProcess = Gio.Subprocess.new(
                    ['gst-play-1.0', '--no-interactive', this._audioPath],
                    Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
                );
                this._audioProcess.wait_async(null, (player, playerResult) => {
                    try {
                        player.wait_finish(playerResult);
                    } catch (_error) {}
                    if (this._audioProcess === player)
                        this._audioProcess = null;
                });
            });
        } catch (_error) {
            this._resultItem.label.set_text('无法启动发音播放器');
            this._resultsMenu.open();
        }
    }

    destroy() {
        this._destroyed = true;
        this._session.abort();
        this._pendingMessage = null;
        if (this._clickLookupId)
            GLib.source_remove(this._clickLookupId);
        this._clickLookupId = null;
        if (this._focusEntryId)
            GLib.source_remove(this._focusEntryId);
        this._focusEntryId = null;
        if (this._downloadProcess)
            this._downloadProcess.force_exit();
        this._downloadProcess = null;
        if (this._audioProcess)
            this._audioProcess.force_exit();
        this._audioProcess = null;
        if (this._stageCapturedEventId)
            global.stage.disconnect(this._stageCapturedEventId);
        this._stageCapturedEventId = null;
        if (this._focusWindowId)
            global.display.disconnect(this._focusWindowId);
        this._focusWindowId = null;
        this._resultsMenu.destroy();
        super.destroy();
    }
});

let indicator = null;

function init() {
}

function enable() {
    indicator = new YoudaoPanelDictionary();
    Main.panel.addToStatusArea('youdao-panel-dictionary', indicator, 0, 'right');
}

function disable() {
    indicator.destroy();
    indicator = null;
}
