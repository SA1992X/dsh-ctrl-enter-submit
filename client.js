/**
 * dsh-ctrl-enter-submit — Client 端
 *
 * 在浏览器中拦截文本输入控件的键盘事件：
 *   - 插件启用时：普通 Enter 换行（阻止 DSH 默认的提交行为），
 *     Ctrl/Cmd+Enter 触发提交。
 *   - 插件禁用/卸载时：移除监听器，恢复默认行为。
 *
 * 覆盖两类输入场景：
 *   1. 主对话框 composer（容器 [data-composer-card] 内的 textarea）。
 *   2. Agent 提问卡片（ask_user_question）的多行自由输入
 *      （容器 [data-question-key] 内的 textarea）。
 *   单行 input（如问答卡片的单行自定义答案）保持原生 Enter 提交——
 *   单行控件里 Enter 换行没有意义。
 *
 * 实现方式：
 *   在 document 捕获阶段监听 keydown。对需要接管的 textarea，普通 Enter 与
 *   Shift+Enter 调用 stopImmediatePropagation() 阻止 React 的提交处理器，
 *   但不调用 preventDefault()，保留原生换行；Ctrl/Cmd+Enter 放行给 DSH 提交。
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
     * 判断事件目标是否是主对话框 composer 内的 textarea。
     */
    function isComposerTextarea(target) {
      if (!(target instanceof HTMLTextAreaElement)) return false;
      return target.closest('[data-composer-card]') !== null;
    }

    /**
     * 判断事件目标是否是 Agent 提问卡片（ask_user_question）内的多行 textarea。
     * 卡片容器带 data-question-key；其单行 input 不在接管范围内。
     */
    function isQuestionTextarea(target) {
      if (!(target instanceof HTMLTextAreaElement)) return false;
      return target.closest('[data-question-key]') !== null;
    }

    /**
     * 判断目标是否是本插件要接管的输入控件（composer 或问答卡片的 textarea）。
     */
    function isManagedTextarea(target) {
      return isComposerTextarea(target) || isQuestionTextarea(target);
    }

    /** keyCode 229 表示浏览器正在处理输入法组合。 */
    const IME_PROCESSING_KEYCODE = 229;

    /**
     * 是否为提交修饰键。仅 Ctrl/Cmd 触发提交。
     * 注意：Shift+Enter 不是提交——DSH 原生命中它会提交，因此这里必须
     * 拦截下来让 textarea 原生换行，不能像 Ctrl/Cmd 一样放行给 DSH。
     */
    function hasSubmitModifier(e) {
      return e.ctrlKey || e.metaKey;
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

      // Ctrl/Cmd+Enter：放行，由 DSH 处理提交（composer 与问答卡片均支持）。
      if (hasSubmitModifier(e)) return;

      // 输入法组合中：放行（普通 Enter 用于确认候选词，Shift+Enter 由浏览器处理）。
      if (isComposing(e)) return;

      if (!isManagedTextarea(e.target)) return;

      // 触发菜单（/、@）仅存在于 composer：可见时让 Enter 正常选择菜单项。
      if (isComposerTextarea(e.target) && isTriggerMenuVisible()) return;

      // 普通 Enter 或 Shift+Enter：阻止冒泡到 React 的 onKeyDown（即 DSH 的
      // 提交处理器——composer 与问答卡片原生对两者都会提交），但不阻止默认
      // 行为，textarea 会自行插入换行。
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
