/**
 * dsh-ctrl-enter-submit — Host 入口。
 *
 * 本插件的实际功能在浏览器端 (client.js) 实现：拦截 textarea 的键盘事件，
 * 将提交快捷键从 Enter 改为 Ctrl/Cmd+Enter。
 *
 * 此模块仅作为 Bundle 的可导入载体存在，确保 Loader 能解析到该包，
 * 并在「设置 › 插件」列表中显示。apply 为空操作。
 *
 * @module dsh-ctrl-enter-submit
 */

export const name = 'ctrl-enter-submit';

/** Host 端无需任何操作；所有逻辑在 Client 端。 */
export function apply() {}
