# dsh-ctrl-enter-submit

[![npm version](https://img.shields.io/npm/v/dsh-ctrl-enter-submit)](https://www.npmjs.com/package/dsh-ctrl-enter-submit)
[![license](https://img.shields.io/npm/l/dsh-ctrl-enter-submit)](./LICENSE)

[English](#english) | 中文

DeepSeek Harness (DSH) 插件：将对话框的提交快捷键从 **Enter** 改为 **Ctrl/Cmd+Enter**，普通 Enter 用于换行。可在「设置 → 插件」中随时开关，禁用后恢复默认行为。

## 行为

| 按键 | 插件启用时 | 插件禁用后 |
|---|---|---|
| Enter | 换行（不提交） | 提交消息 |
| Ctrl/Cmd+Enter | 提交消息 | 提交消息（DSH 原本就支持） |
| Shift+Enter | 换行 | 提交消息（DSH 原生行为） |

`/` 和 `@` 触发菜单打开时，Enter 仍然正常选择菜单项，不会被拦截。输入法组合状态下也不会被拦截。

## 安装

从插件市场安装：打开 **Settings → Plugin Market**，搜索 `dsh-ctrl-enter-submit`，一键安装。

或用命令行：

```bash
dsh plugin --profile web add dsh-ctrl-enter-submit
```

安装后刷新浏览器页面即可生效（纯客户端插件，无需重启服务）。

## 启用 / 禁用

在 DSH Web 界面的 **设置 → 插件（Plugins）** 中找到 `ctrl-enter-submit`，用开关切换：
- 关闭：立即恢复 Enter 提交（刷新页面后生效）
- 打开：恢复 Ctrl/Cmd+Enter 提交

卸载：

```bash
dsh plugin --profile web remove dsh-ctrl-enter-submit
```

## 工作原理

插件在浏览器端的 `document` 捕获阶段拦截 `keydown` 事件：

- 目标限定为 composer 内的 `textarea`
- 普通 Enter 与 Shift+Enter（无 Ctrl/Cmd 修饰、非输入法组合、非 `/`/`@` 菜单打开）：调用 `stopImmediatePropagation()` 阻止事件冒泡到 React 的 `onKeyDown` 处理器（即 DSH 的提交逻辑），但不调用 `preventDefault()`，因此 textarea 照常换行
- Ctrl/Cmd+Enter：放行，由 DSH 正常提交
- 插件 Host 端为空操作，所有功能均在浏览器 Client 端实现

## 兼容性

- 需要 dsh web `0.1.0-rc.6` 或更高版本
- 在 Windows、macOS、Linux 上均可工作（Ctrl 和 Cmd 都识别）

## 本地开发

用本地路径以链接方式安装，改完 `client.js` 后刷新浏览器即可看到效果，无需重新发布：

```bash
dsh plugin --profile web add ./dsh-ctrl-enter-submit
```

---

<a name="english"></a>
# English

A DeepSeek Harness (DSH) plugin that changes the composer submit shortcut from **Enter** to **Ctrl/Cmd+Enter**, so plain Enter inserts a newline. Toggle it on/off anytime in **Settings → Plugins**; disabling restores the default Enter-submit behavior.

## Behavior

| Key | Plugin enabled | Plugin disabled |
|---|---|---|
| Enter | Newline (no submit) | Submits the message |
| Ctrl/Cmd+Enter | Submits the message | Submits (DSH supports this natively) |
| Shift+Enter | Newline | Submits the message (DSH native behavior) |

When the `/` or `@` candidate menu is open, Enter selects the highlighted item as usual. IME composition is never intercepted.

## Install

From the Plugin Market: open **Settings → Plugin Market**, search for `dsh-ctrl-enter-submit`, and install with one click.

Or from the command line:

```bash
dsh plugin --profile web add dsh-ctrl-enter-submit
```

Refresh the browser page after installing (client-only plugin, no restart needed).

## Enable / Disable

Find `ctrl-enter-submit` in **Settings → Plugins** and toggle it:
- Off: Enter submits again (takes effect after a page refresh)
- On: Ctrl/Cmd+Enter submits

To uninstall:

```bash
dsh plugin --profile web remove dsh-ctrl-enter-submit
```

## How it works

The plugin intercepts `keydown` on `document` during the capture phase, scoped to the composer `textarea`:

- Plain Enter and Shift+Enter (no Ctrl/Cmd modifier, not composing, no `/`/`@` menu open) call `stopImmediatePropagation()` so React's `onKeyDown` handler (DSH's submit logic) never sees it, but it does **not** call `preventDefault()`, so the textarea inserts a newline normally. Note DSH natively submits on Shift+Enter too, so the plugin also intercepts it to produce a newline.
- Ctrl/Cmd+Enter is left untouched and submits as usual.
- The host entry is a no-op; all behavior lives in the browser client.

## Compatibility

- Requires dsh web `0.1.0-rc.6` or later.
- Works on Windows, macOS, and Linux (both Ctrl and Cmd are recognized).

## License

MIT

