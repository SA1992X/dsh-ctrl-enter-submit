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

    /**
     * 捕获阶段 keydown 处理器。
     */
    function handleKeyDown(e) {
      if (e.key !== 'Enter') return;

      // Ctrl/Cmd+Enter 组合键：放行，让 DSH 正常提交。
      if (e.ctrlKey || e.metaKey) return;

      // Shift+Enter：放行（原生换行，DSH 也不会提交）。
      if (e.shiftKey) return;

      // 输入法组合中：放行。
      if (e.isComposing || e.keyCode === 229) return;

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
