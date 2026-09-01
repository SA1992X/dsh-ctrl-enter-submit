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
 *   2. Agent 提问卡片（ask_user_question）：
 *      - 多行 textarea：普通 Enter / Shift+Enter 换行，Ctrl/Cmd+Enter 下一题/提交；
 *      - 单行 input：普通 Enter 不动作（单行无换行），Ctrl/Cmd+Enter 下一题/提交；
 *      - 选项按钮（radio/checkbox）：普通 Enter 不选中/不跳题（避免误触），
 *        鼠标点击与空格选择不受影响，Ctrl/Cmd+Enter 在全部答完时可提交。
 *
 * 实现方式：
 *   在 document 捕获阶段监听 keydown。对多行 textarea，普通 Enter 与
 *   Shift+Enter 调用 stopImmediatePropagation() 阻止 React 的提交处理器，
 *   但不调用 preventDefault()，保留原生换行；对单行 input 与选项按钮，普通
 *   Enter 额外调用 preventDefault() 以彻底抵消原生激活行为；Ctrl/Cmd+Enter
 *   一律放行给 DSH 提交/下一题。
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
     * 卡片容器带 data-question-key；单行 input 与选项按钮见下方专门判断。
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

    /**
     * 判断事件目标是否是提问卡片内的单行文本 input（自定义答案框）。
     */
    function isQuestionInput(target) {
      if (!(target instanceof HTMLInputElement)) return false;
      if (target.type !== 'text' && target.type !== 'search' &&
          target.type !== 'url' && target.type !== 'email' &&
          target.type !== '' && target.type !== undefined) return false;
      return target.closest('[data-question-key]') !== null;
    }

    /**
     * 判断事件目标是否是提问卡片内的选项按钮（role=radio/checkbox）。
     * 排除底部的翻页/提交/取消等操作按钮（它们没有这些 role）。
     */
    function isQuestionOptionButton(target) {
      if (!(target instanceof HTMLButtonElement)) return false;
      const role = target.getAttribute('role');
      if (role !== 'radio' && role !== 'checkbox') return false;
      return target.closest('[data-question-key]') !== null;
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

      // Ctrl/Cmd+Enter：放行，由 DSH 处理提交/下一题（各类控件均支持）。
      if (hasSubmitModifier(e)) return;

      const target = e.target;

      // ── 多行 textarea（composer 与问答卡片）──
      if (isManagedTextarea(target)) {
        // 输入法组合中：放行（普通 Enter 用于确认候选词）。
        if (isComposing(e)) return;
        // 触发菜单（/、@）仅存在于 composer：可见时让 Enter 正常选择菜单项。
        if (isComposerTextarea(target) && isTriggerMenuVisible()) return;
        // 普通 Enter 或 Shift+Enter：阻止 React 的提交处理器，但不阻止默认
        // 行为，textarea 会自行插入换行。
        e.stopImmediatePropagation();
        return;
      }

      // ── 提问卡片的单行 input ──
      if (isQuestionInput(target)) {
        if (isComposing(e)) return;
        // 单行框无换行需求：阻止 React 的下一题/提交，并抵消默认激活行为。
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // ── 提问卡片的选项按钮（radio/checkbox）──
      if (isQuestionOptionButton(target)) {
        if (isComposing(e)) return;
        // 阻止普通 Enter 触发“选中并跳题/提交”。鼠标点击与空格选择不受影响。
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
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
