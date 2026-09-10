/**
 * dsh-ctrl-enter-submit — Client 端
 *
 * 在浏览器中拦截文本输入控件的键盘事件：
 *   - 插件启用时：普通 Enter 换行（阻止 DSH 默认的提交行为），
 *     Ctrl/Cmd+Enter 触发提交。
 *   - 插件禁用/卸载时：移除监听器，恢复默认行为。
 *
 * 覆盖两类输入场景：
 *   1. 主对话框 composer（容器 [data-composer-card] 内的输入面）：
 *      - DSH ≥ 0.1.2：contenteditable 编辑器（[data-composer-input]），提交由
 *        Lexical 的 KEY_ENTER_COMMAND 键位表决定，普通 Enter 会直接发送；
 *      - 更早的版本：卡片内的 textarea，提交由 React onKeyDown 决定。
 *   2. Agent 提问卡片（ask_user_question）：
 *      - 多行 textarea：普通 Enter / Shift+Enter 换行，Ctrl/Cmd+Enter 下一题/提交；
 *      - 单行 input：普通 Enter 不动作（单行无换行），Ctrl/Cmd+Enter 下一题/提交；
 *      - 选项按钮（radio/checkbox）：普通 Enter 不选中/不跳题（避免误触），
 *        鼠标点击与空格选择不受影响，Ctrl/Cmd+Enter 在全部答完时可提交。
 *
 * 实现方式：
 *   在 document 捕获阶段监听 keydown，所以一定早于编辑器根元素（Lexical 把
 *   keydown 挂在 contenteditable 根上）与 React 在容器上的委托监听。对多行输入
 *   面分两种处理：
 *   - textarea：调用 stopImmediatePropagation() 阻止 React 的提交处理器，但不
 *     调用 preventDefault()，保留原生换行；
 *   - contenteditable：把事件伪装成 Shift+Enter（DSH 键位表对 shiftKey 直接返回
 *     false），让 DSH 自己的 INSERT_LINE_BREAK 路径插入换行，行为与用户按住
 *     Shift 按 Enter 完全一致；伪装失败时退化为阻断传播，宁可换行也不提交。
 *   单行 input 与选项按钮的普通 Enter 额外调用 preventDefault() 以彻底抵消原生
 *   激活行为；Ctrl/Cmd+Enter 一律放行给 DSH 提交/下一题。
 */

window.__ModuleLoader__.load({
  id: 'dsh-ctrl-enter-submit',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    /** 插件名，与 cordis.patch.yml 中的 id 对应。 */
    const name = 'ctrl-enter-submit';

    /** keyCode 229 表示浏览器正在处理输入法组合。 */
    const IME_PROCESSING_KEYCODE = 229;

    /** 是否处于输入法组合状态（中文/日文/韩文输入等）。 */
    function isComposing(e) {
      return e.isComposing || e.keyCode === IME_PROCESSING_KEYCODE;
    }

    /**
     * 是否为提交修饰键。仅 Ctrl/Cmd 触发提交。
     * 注意：Shift+Enter 不是提交——DSH 键位表把带 shift 的 Enter 当作换行，
     * 因此这里不能把 Shift 视为提交修饰键。
     */
    function hasSubmitModifier(e) {
      return e.ctrlKey || e.metaKey;
    }

    /**
     * slash/at 触发菜单当前是否可见。
     * 菜单由 dsh-client-ui-input-trigger 渲染到 composer 卡片的 overlay 插槽，
     * 打开时带 data-trigger-menu，role="listbox"；关闭时不渲染。用 getClientRects()
     * 判断可见性，避免 offsetParent 对 fixed 定位元素返回 null 的误判。
     */
    function isTriggerMenuVisible() {
      const card = document.querySelector('[data-composer-card]');
      if (card === null) return false;
      const menu = card.querySelector('[data-trigger-menu], [role="listbox"]');
      return menu instanceof Element && menu.getClientRects().length > 0;
    }

    /**
     * 事件目标所属的主对话框输入面；不属于 composer 卡片时返回 null。
     * @param target - keydown 的事件目标
     * @returns contenteditable 编辑器、旧版 textarea，或 null
     */
    function composerInputOf(target) {
      if (!(target instanceof Element)) return null;
      const card = target.closest('[data-composer-card]');
      if (card === null) return null;
      // DSH ≥ 0.1.2：Lexical 编辑器宿主 div（可编辑时才接管；无会话的
      // 工作区引导态不可编辑，应保留其原生 Enter 行为）。
      const editor = target.closest('[data-composer-input], [contenteditable="true"]');
      if (editor !== null && editor.isContentEditable === true) return editor;
      // 更早版本：卡片内的 textarea。
      if (target instanceof HTMLTextAreaElement) return target;
      return target.closest('textarea');
    }

    /**
     * 事件目标所属的提问卡片（ask_user_question）容器。
     * @param target - keydown 的事件目标
     * @returns 卡片容器元素，或 null
     */
    function questionCardOf(target) {
      return target instanceof Element ? target.closest('[data-question-key]') : null;
    }

    /**
     * 判断事件目标是否是提问卡片内的单行文本 input（自定义答案框）。
     * 兼容早期版本：新版自定义答案已改为多行 textarea。
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

    /**
     * 把事件伪装成 Shift+Enter，让 DSH 走自己的换行路径。
     *
     * DSH ≥ 0.1.2 的 composer 是 Lexical contenteditable：键位表在
     * KEY_ENTER_COMMAND 上先判断 event.shiftKey，为 true 时返回 false，随后由
     * 编辑器的 INSERT_LINE_BREAK 命令插入换行。给原事件加一个自有的 shiftKey
     * 取值即可复用该路径，事件本身保持可信、继续正常传播，既不 preventDefault
     * 也不阻断传播。
     *
     * @param e - 原始 keydown 事件
     * @returns 伪装是否生效；false 表示调用方应退化为阻断传播
     */
    function requestNewline(e) {
      try {
        Object.defineProperty(e, 'shiftKey', { value: true, configurable: true });
      } catch {
        return false;
      }
      return e.shiftKey === true;
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

      // 输入法组合中：放行（普通 Enter 用于确认候选词）。
      if (isComposing(e)) return;

      const target = e.target;

      // ── 主对话框 composer ──
      const composer = composerInputOf(target);
      if (composer !== null) {
        // 触发菜单（/、@）可见时让 Enter 正常选择菜单项。
        if (isTriggerMenuVisible()) return;
        if (composer instanceof HTMLTextAreaElement) {
          // 旧版 textarea：阻止 React 的提交处理器，但不阻止默认行为，
          // textarea 会自行插入换行。
          e.stopImmediatePropagation();
          return;
        }
        // 新版 contenteditable：伪装成 Shift+Enter 让编辑器插入换行。
        if (requestNewline(e)) return;
        // 兜底：伪装失败时阻断提交链路，由浏览器默认行为插入换行。
        e.stopImmediatePropagation();
        return;
      }

      // ── 提问卡片 ──
      if (questionCardOf(target) === null) return;

      // 多行 textarea：阻止 React 的下一题/提交，保留原生换行。
      if (target instanceof HTMLTextAreaElement) {
        e.stopImmediatePropagation();
        return;
      }

      // 选项按钮（radio/checkbox）：阻止普通 Enter 触发“选中并跳题/提交”。
      // 鼠标点击与空格选择不受影响。
      if (isQuestionOptionButton(target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // 单行输入框：无换行需求，阻止 React 的下一题/提交并抵消默认激活行为。
      if (isQuestionInput(target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
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

      // 在捕获阶段注册，确保早于 Lexical 在编辑器根元素上的监听与 React 在
      // 容器上的委托监听。
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
