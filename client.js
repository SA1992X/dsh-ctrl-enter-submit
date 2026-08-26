/**
 * dsh-ctrl-enter-submit — Client 端
 *
 * 在浏览器中拦截对话框 textarea 的键盘事件：
 *   - 插件启用时：普通 Enter 换行（阻止 DSH 默认的提交行为），
 *     Ctrl/Cmd+Enter 触发提交。
 *   - 插件禁用/卸载时：移除监听器，恢复默认行为。
 *
 * 实现方式：
 *   在 document 捕获阶段监听 keydown，目标限定为 composer textarea。
 *   当 / 或 @ 触发菜单打开时，不拦截 Enter，让用户正常选择菜单项。
 *   其他情况下，对普通 Enter 调用 stopImmediatePropagation() 阻止 React
 *   合成事件处理器（DSH 的提交逻辑），同时不调用 preventDefault()，
 *   保留 textarea 原生换行。
 */

window.__ModuleLoader__.load({
  id: 'dsh-ctrl-enter-submit',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    /** 插件名，与 cordis.patch.yml 中的 id 对应。 */
    const name = 'ctrl-enter-submit';

    /**
     * 判断 slash/at 触发菜单当前是否可见。
     * 菜单 DOM 由 dsh-client-ui-input-trigger 渲染，role="listbox"，
     * 位于 composer card 内部。
     */
    function isTriggerMenuVisible() {
      const menu = document.querySelector('[data-composer-card] [role="listbox"]');
      // offsetParent is an HTMLElement-only property; guard for non-element matches.
      return menu instanceof HTMLElement && menu.offsetParent !== null;
    }

    /**
     * 判断事件目标是否是 composer 内的 textarea。
     */
    function isComposerTextarea(target) {
      if (!(target instanceof HTMLTextAreaElement)) return false;
      return target.closest('[data-composer-card]') !== null;
    }

    /** keyCode 229 表示浏览器正在处理输入法组合。 */
    const IME_PROCESSING_KEYCODE = 229;

    /** Enter 被修饰键（Ctrl/Cmd/Shift）按住时，交给 DSH/浏览器原生处理。 */
    function hasSubmitOrNewlineModifier(e) {
      return e.ctrlKey || e.metaKey || e.shiftKey;
    }

    /** 是否处于输入法组合状态（中文/日文/韩文输入等）。 */
    function isComposing(e) {
      return e.isComposing || e.keyCode === IME_PROCESSING_KEYCODE;
    }

    /**
     * 捕获阶段 keydown 处理器。
     */
    function handleKeyDown(e) {
      if (e.key !== 'Enter') return;

      // Let another capture-phase listener own the key if it already did.
      if (e.defaultPrevented) return;

      // Ctrl/Cmd+Enter 提交，Shift+Enter 换行：均放行。
      if (hasSubmitOrNewlineModifier(e)) return;

      // 输入法组合中：放行。
      if (isComposing(e)) return;

      if (!isComposerTextarea(e.target)) return;

      // 触发菜单（/、@）可见时，让 Enter 正常选择菜单项。
      if (isTriggerMenuVisible()) return;

      // 普通 Enter：阻止冒泡到 React 的 onKeyDown（即 DSH 的提交处理器），
      // 但不阻止默认行为，textarea 会自行插入换行。
      e.stopImmediatePropagation();
    }

    let registered = false;

    /**
     * Cordis 插件入口。
     * @param {object} ctx - Cordis 客户端上下文
     */
    function apply(ctx) {
      // Guard against double registration under HMR / repeated apply.
      if (registered) return;
      registered = true;

      // 在捕获阶段注册，确保早于 React 在 root 上的冒泡监听。
      document.addEventListener('keydown', handleKeyDown, true);

      // 插件卸载时清理。
      ctx.effect(() => {
        return () => {
          document.removeEventListener('keydown', handleKeyDown, true);
          registered = false;
        };
      }, 'ctrl-enter-submit: keydown interceptor');
    }

    exports.name = name;
    exports.apply = apply;
    return module.exports;
  }
});
