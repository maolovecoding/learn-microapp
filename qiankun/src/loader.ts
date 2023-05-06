/**
 * @author Kuitos
 * @since 2020-04-01
 */

import { importEntry } from 'import-html-entry';
import { concat, forEach, mergeWith } from 'lodash';
import type { LifeCycles, ParcelConfigObject } from 'single-spa';
import getAddOns from './addons';
import { QiankunError } from './error';
import { getMicroAppStateActions } from './globalState';
import type {
  FrameworkConfiguration,
  FrameworkLifeCycles,
  HTMLContentRender,
  LifeCycleFn,
  LoadableApp,
  ObjectType,
} from './interfaces';
import { createSandboxContainer, css } from './sandbox';
import { cachedGlobals } from './sandbox/proxySandbox';
import {
  Deferred,
  genAppInstanceIdByName,
  getContainer,
  getDefaultTplWrapper,
  getWrapperId,
  isEnableScopedCSS,
  performanceGetEntriesByName,
  performanceMark,
  performanceMeasure,
  toArray,
  validateExportLifecycle,
} from './utils';

function assertElementExist(element: Element | null | undefined, msg?: string) {
  if (!element) {
    if (msg) {
      throw new QiankunError(msg);
    }

    throw new QiankunError('element not existed!');
  }
}

function execHooksChain<T extends ObjectType>(
  hooks: Array<LifeCycleFn<T>>,
  app: LoadableApp<T>,
  global = window,
): Promise<any> {
  if (hooks.length) {
    return hooks.reduce((chain, hook) => chain.then(() => hook(app, global)), Promise.resolve());
  }

  return Promise.resolve();
}

async function validateSingularMode<T extends ObjectType>(
  validate: FrameworkConfiguration['singular'],
  app: LoadableApp<T>,
): Promise<boolean> {
  return typeof validate === 'function' ? validate(app) : !!validate;
}

const supportShadowDOM = !!document.head.attachShadow || !!(document.head as any).createShadowRoot;

function createElement(
  appContent: string,
  strictStyleIsolation: boolean,
  scopedCSS: boolean,
  appInstanceId: string,
): HTMLElement {
  const containerElement = document.createElement('div');
  // TODO 文本标签 变成真正的DOM
  containerElement.innerHTML = appContent;
  // appContent always wrapped with a singular div
  // 这就可以拿到真实DOM
  const appElement = containerElement.firstChild as HTMLElement;
  if (strictStyleIsolation) {
    // 严格样式隔离
    if (!supportShadowDOM) {
      // 不支持 shadow dom
      console.warn(
        '[qiankun]: As current browser not support shadow dom, your strictStyleIsolation configuration will be ignored!',
      );
    } else {
      // 拿到 dom
      const { innerHTML } = appElement;
      appElement.innerHTML = ''; // 清空 div
      let shadow: ShadowRoot;
      // 设置 mode: 'open' 外面可以拿到shadowdom的节点
      if (appElement.attachShadow) {
        shadow = appElement.attachShadow({ mode: 'open' });
      } else {
        // createShadowRoot was proposed in initial spec, which has then been deprecated
        shadow = (appElement as any).createShadowRoot();
      }
      shadow.innerHTML = innerHTML;
    }
  }
  // 作用域css 拿到所有的style标签css增加css前缀
  // TODO link标签？link转为style了，然后css.process方法
  if (scopedCSS) {
    const attr = appElement.getAttribute(css.QiankunCSSRewriteAttr);
    if (!attr) {
      appElement.setAttribute(css.QiankunCSSRewriteAttr, appInstanceId);
    }

    const styleNodes = appElement.querySelectorAll('style') || [];
    forEach(styleNodes, (stylesheetElement: HTMLStyleElement) => {
      // css处理
      css.process(appElement!, stylesheetElement, appInstanceId);
    });
  }

  return appElement;
}

/** generate app wrapper dom getter */
function getAppWrapperGetter(
  appInstanceId: string,
  useLegacyRender: boolean,
  strictStyleIsolation: boolean,
  scopedCSS: boolean,
  elementGetter: () => HTMLElement | null,
) {
  return () => {
    if (useLegacyRender) {
      if (strictStyleIsolation) throw new QiankunError('strictStyleIsolation can not be used with legacy render!');
      if (scopedCSS) throw new QiankunError('experimentalStyleIsolation can not be used with legacy render!');

      const appWrapper = document.getElementById(getWrapperId(appInstanceId));
      assertElementExist(appWrapper, `Wrapper element for ${appInstanceId} is not existed!`);
      return appWrapper!;
    }

    const element = elementGetter();
    assertElementExist(element, `Wrapper element for ${appInstanceId} is not existed!`);

    if (strictStyleIsolation && supportShadowDOM) {
      return element!.shadowRoot!;
    }

    return element!;
  };
}

const rawAppendChild = HTMLElement.prototype.appendChild;
const rawRemoveChild = HTMLElement.prototype.removeChild;
type ElementRender = (
  props: { element: HTMLElement | null; loading: boolean; container?: string | HTMLElement },
  phase: 'loading' | 'mounting' | 'mounted' | 'unmounted',
) => any;

/**
 * Get the render function
 * If the legacy render function is provide, used as it, otherwise we will insert the app element to target container by qiankun
 * @param appInstanceId
 * @param appContent
 * @param legacyRender
 */
function getRender(appInstanceId: string, appContent: string, legacyRender?: HTMLContentRender) {
  const render: ElementRender = ({ element, loading, container }, phase) => {
    if (legacyRender) {
      if (process.env.NODE_ENV === 'development') {
        console.error(
          '[qiankun] Custom rendering function is deprecated and will be removed in 3.0, you can use the container element setting instead!',
        );
      }

      return legacyRender({ loading, appContent: element ? appContent : '' });
    }

    const containerElement = getContainer(container!);

    // The container might have be removed after micro app unmounted.
    // Such as the micro app unmount lifecycle called by a react componentWillUnmount lifecycle, after micro app unmounted, the react component might also be removed
    if (phase !== 'unmounted') {
      const errorMsg = (() => {
        switch (phase) {
          case 'loading':
          case 'mounting':
            return `Target container with ${container} not existed while ${appInstanceId} ${phase}!`;

          case 'mounted':
            return `Target container with ${container} not existed after ${appInstanceId} ${phase}!`;

          default:
            return `Target container with ${container} not existed while ${appInstanceId} rendering!`;
        }
      })();
      assertElementExist(containerElement, errorMsg);
    }

    if (containerElement && !containerElement.contains(element)) {
      // clear the container
      while (containerElement!.firstChild) {
        rawRemoveChild.call(containerElement, containerElement!.firstChild);
      }

      // append the element to container if it exist
      if (element) {
        rawAppendChild.call(containerElement, element);
      }
    }

    return undefined;
  };

  return render;
}

function getLifecyclesFromExports(
  scriptExports: LifeCycles<any>,
  appName: string,
  global: WindowProxy,
  globalLatestSetProp?: PropertyKey | null,
) {
  if (validateExportLifecycle(scriptExports)) {
    return scriptExports;
  }

  // fallback to sandbox latest set property if it had
  if (globalLatestSetProp) {
    const lifecycles = (<any>global)[globalLatestSetProp];
    if (validateExportLifecycle(lifecycles)) {
      return lifecycles;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[qiankun] lifecycle not found from ${appName} entry exports, fallback to get from window['${appName}']`,
    );
  }

  // fallback to global variable who named with ${appName} while module exports not found
  const globalVariableExports = (global as any)[appName];

  if (validateExportLifecycle(globalVariableExports)) {
    return globalVariableExports;
  }

  throw new QiankunError(`You need to export lifecycle functions in ${appName} entry`);
}

let prevAppUnmountedDeferred: Deferred<void>;

export type ParcelConfigObjectGetter = (remountContainer?: string | HTMLElement) => ParcelConfigObject;

/**
 * 加载 app资源
 */
export async function loadApp<T extends ObjectType>(
  app: LoadableApp<T>,
  configuration: FrameworkConfiguration = {},
  lifeCycles?: FrameworkLifeCycles<T>,
): Promise<ParcelConfigObjectGetter> {
  const { entry, name: appName } = app; // 入口 name
  // 给应用搞一个名字
  const appInstanceId = genAppInstanceIdByName(appName);

  const markName = `[qiankun] App ${appInstanceId} Loading`;
  if (process.env.NODE_ENV === 'development') {
    performanceMark(markName);
  }

  const {
    singular = false,
    sandbox = true,
    excludeAssetFilter,
    globalContext = window,
    ...importEntryOpts
  } = configuration;

  // get the entry html content and script executor
  // 获取html文件，并且拿到脚本执行器
  // execScripts 真正的脚本逻辑
  const { template, execScripts, assetPublicPath, getExternalScripts } = await importEntry(entry, importEntryOpts);
  // trigger external scripts loading to make sure all assets are ready before execScripts calling
  // 加载外部脚本，比如加载 index.js之前 应该加载依赖项 react啊等
  await getExternalScripts();

  // as single-spa load and bootstrap new app parallel with other apps unmounting
  // (see https://github.com/CanopyTax/single-spa/blob/master/src/navigation/reroute.js#L74)
  // we need wait to load the app until all apps are finishing unmount in singular mode
  if (await validateSingularMode(singular, app)) {
    // TODO 单例 在挂载新的应用之前要保证上个应用已经卸载
    await (prevAppUnmountedDeferred && prevAppUnmountedDeferred.promise);
  }
  // template 是index.html 但是脚本和css被注释了
  // 获取文件内容
  const appContent = getDefaultTplWrapper(appInstanceId, sandbox)(template);
  // sandbox.strictStyleIsolation shadomDOM 加载css
  const strictStyleIsolation = typeof sandbox === 'object' && !!sandbox.strictStyleIsolation;

  if (process.env.NODE_ENV === 'development' && strictStyleIsolation) {
    console.warn(
      "[qiankun] strictStyleIsolation configuration will be removed in 3.0, pls don't depend on it or use experimentalStyleIsolation instead!",
    );
  }
  // 作用域css的处理
  const scopedCSS = isEnableScopedCSS(sandbox);
  // 处理内容变成dom，处理css
  let initialAppWrapperElement: HTMLElement | null = createElement(
    appContent,
    strictStyleIsolation,
    scopedCSS,
    appInstanceId,
  );
  // 应用初始化位置
  const initialContainer = 'container' in app ? app.container : undefined;
  const legacyRender = 'render' in app ? app.render : undefined;

  const render = getRender(appInstanceId, appContent, legacyRender);

  // 第一次加载设置应用可见区域 dom 结构
  // 确保每次应用加载前容器 dom 结构已经设置完毕
  render({ element: initialAppWrapperElement, loading: true, container: initialContainer }, 'loading');

  const initialAppWrapperGetter = getAppWrapperGetter(
    appInstanceId,
    !!legacyRender,
    strictStyleIsolation,
    scopedCSS,
    () => initialAppWrapperElement,
  );

  let global = globalContext; // 全局 “window”
  // 挂载 卸载沙箱
  let mountSandbox = () => Promise.resolve();
  let unmountSandbox = () => Promise.resolve();
  // loose快照沙箱
  const useLooseSandbox = typeof sandbox === 'object' && !!sandbox.loose;
  // enable speedy mode by default
  // TODO 默认开启speedy沙箱模式 （proxy）
  const speedySandbox = typeof sandbox === 'object' ? sandbox.speedy !== false : true;
  let sandboxContainer;
  if (sandbox) {
    // 创建沙箱容器
    sandboxContainer = createSandboxContainer(
      appInstanceId,
      // FIXME should use a strict sandbox logic while remount, see https://github.com/umijs/qiankun/issues/518
      initialAppWrapperGetter,
      scopedCSS,
      useLooseSandbox,
      excludeAssetFilter,
      global,
      speedySandbox,
    );
    // 用沙箱的代理对象作为接下来使用的全局对象
    global = sandboxContainer.instance.proxy as typeof window;
    mountSandbox = sandboxContainer.mount;
    unmountSandbox = sandboxContainer.unmount;
  }
  // execScripts 在沙箱中跑脚本
  // getAddOns 默认在执行前 需要给global（模拟的window给子应用使用）扩展自定义属性
  // 五个钩子
  const {
    beforeUnmount = [],
    afterUnmount = [],
    afterMount = [],
    beforeMount = [],
    beforeLoad = [],
  } = mergeWith({}, getAddOns(global, assetPublicPath), lifeCycles, (v1, v2) => concat(v1 ?? [], v2 ?? []));

  await execHooksChain(toArray(beforeLoad), app, global);
  // 根据沙箱环境执行子应用的脚本
  // get the lifecycle hooks from module exports
  const scriptExports: any = await execScripts(global, sandbox && !useLooseSandbox, {
    scopedGlobalVariables: speedySandbox ? cachedGlobals : [],
  });
  // 拿到子应用导出的接入协议，（我们可以获取到在window上最后增加的属性）之后拿到对应的脚本执行后拿到协议
  const { bootstrap, mount, unmount, update } = getLifecyclesFromExports(
    scriptExports,
    appName,
    global,
    sandboxContainer?.instance?.latestSetProp,
  );
  // TODO 生成通信方法 qiankun3会移除
  const { onGlobalStateChange, setGlobalState, offGlobalStateChange }: Record<string, CallableFunction> =
    getMicroAppStateActions(appInstanceId);

  // FIXME temporary way
  const syncAppWrapperElement2Sandbox = (element: HTMLElement | null) => (initialAppWrapperElement = element);

  const parcelConfigGetter: ParcelConfigObjectGetter = (remountContainer = initialContainer) => {
    let appWrapperElement: HTMLElement | null;
    let appWrapperGetter: ReturnType<typeof getAppWrapperGetter>;
    // 合成配置
    const parcelConfig: ParcelConfigObject = {
      name: appInstanceId,
      bootstrap,
      mount: [
        async () => {
          if (process.env.NODE_ENV === 'development') {
            const marks = performanceGetEntriesByName(markName, 'mark');
            // mark length is zero means the app is remounting
            if (marks && !marks.length) {
              performanceMark(markName);
            }
          }
        },
        async () => {
          // 单例模式要卸载后才能挂载
          if ((await validateSingularMode(singular, app)) && prevAppUnmountedDeferred) {
            return prevAppUnmountedDeferred.promise;
          }

          return undefined;
        },
        // initial wrapper element before app mount/remount
        async () => {
          appWrapperElement = initialAppWrapperElement;
          appWrapperGetter = getAppWrapperGetter(
            appInstanceId,
            !!legacyRender,
            strictStyleIsolation,
            scopedCSS,
            () => appWrapperElement,
          );
        },
        // 添加 mount hook, 确保每次应用加载前容器 dom 结构已经设置完毕
        async () => {
          const useNewContainer = remountContainer !== initialContainer;
          if (useNewContainer || !appWrapperElement) {
            // element will be destroyed after unmounted, we need to recreate it if it not exist
            // or we try to remount into a new container
            appWrapperElement = createElement(appContent, strictStyleIsolation, scopedCSS, appInstanceId);
            syncAppWrapperElement2Sandbox(appWrapperElement);
          }

          render({ element: appWrapperElement, loading: true, container: remountContainer }, 'mounting');
        },
        mountSandbox, // 沙箱挂载后
        // exec the chain after rendering to keep the behavior with beforeLoad
        async () => execHooksChain(toArray(beforeMount), app, global),
        async (props) => mount({ ...props, container: appWrapperGetter(), setGlobalState, onGlobalStateChange }),
        // finish loading after app mounted
        async () => render({ element: appWrapperElement, loading: false, container: remountContainer }, 'mounted'),
        async () => execHooksChain(toArray(afterMount), app, global),
        // initialize the unmount defer after app mounted and resolve the defer after it unmounted
        async () => {
          if (await validateSingularMode(singular, app)) {
            prevAppUnmountedDeferred = new Deferred<void>(); // 单例 防止重复利用promise状态
          }
        },
        async () => {
          if (process.env.NODE_ENV === 'development') {
            const measureName = `[qiankun] App ${appInstanceId} Loading Consuming`;
            performanceMeasure(measureName, markName);
          }
        },
      ],
      unmount: [
        async () => execHooksChain(toArray(beforeUnmount), app, global),
        async (props) => unmount({ ...props, container: appWrapperGetter() }),
        unmountSandbox,
        async () => execHooksChain(toArray(afterUnmount), app, global),
        async () => {
          render({ element: null, loading: false, container: remountContainer }, 'unmounted');
          offGlobalStateChange(appInstanceId);
          // for gc
          appWrapperElement = null;
          syncAppWrapperElement2Sandbox(appWrapperElement);
        },
        async () => {
          if ((await validateSingularMode(singular, app)) && prevAppUnmountedDeferred) {
            prevAppUnmountedDeferred.resolve();
          }
        },
      ],
    };

    if (typeof update === 'function') {
      parcelConfig.update = update; // single-spa使用
    }

    return parcelConfig;
  };

  return parcelConfigGetter;
}
