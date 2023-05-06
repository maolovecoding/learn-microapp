import { noop } from 'lodash';
import type { ParcelConfigObject } from 'single-spa';
import {
  mountRootParcel,
  registerApplication,
  start as startSingleSpa, // start方法
} from 'single-spa';
import type {
  FrameworkConfiguration,
  FrameworkLifeCycles,
  LoadableApp,
  MicroApp,
  ObjectType,
  RegistrableApp,
} from './interfaces';
import type { ParcelConfigObjectGetter } from './loader';
import { loadApp } from './loader';
import { doPrefetchStrategy } from './prefetch';
import { Deferred, getContainerXPath, isConstDestructAssignmentSupported, toArray } from './utils';
/*
  注册走的是single-spa start也是
  多了：
  1. 预先加载规则 requestIdleCallback
  2. 沙箱 css沙箱（创建sandbox 让你的execScripts方法运行在sanbox） 样式隔离（shadow dom， scoped css）
*/

/**
 * 注册过的 apps
 */
let microApps: Array<RegistrableApp<Record<string, unknown>>> = [];

export let frameworkConfiguration: FrameworkConfiguration = {};

let started = false;
const defaultUrlRerouteOnly = true;

const frameworkStartedDefer = new Deferred<void>(); // 等待调用start方法

/**
 * 沙箱降级
 * @param configuration
 * @returns
 */
const autoDowngradeForLowVersionBrowser = (configuration: FrameworkConfiguration): FrameworkConfiguration => {
  const { sandbox = true, singular } = configuration;
  if (sandbox) {
    // 没有支持Proxy
    if (!window.Proxy) {
      console.warn('[qiankun] Missing window.Proxy, proxySandbox will degenerate into snapshotSandbox');

      if (singular === false) {
        // 不是单例 多例沙箱必须是支持proxy的
        console.warn(
          '[qiankun] Setting singular as false may cause unexpected behavior while your browser not support window.Proxy',
        );
      }
      // loose 表示是快照沙箱
      return { ...configuration, sandbox: typeof sandbox === 'object' ? { ...sandbox, loose: true } : { loose: true } };
    }
    // speedy 快速 不支持快速模式
    // TODO 为什么10.4新增speedy模式
    if (
      !isConstDestructAssignmentSupported() && // 不支持解构赋值
      (sandbox === true || (typeof sandbox === 'object' && sandbox.speedy !== false))
    ) {
      console.warn(
        '[qiankun] Speedy mode will turn off as const destruct assignment not supported in current browser!',
      );

      return {
        ...configuration,
        sandbox: typeof sandbox === 'object' ? { ...sandbox, speedy: false } : { speedy: false },
      };
    }
  }

  return configuration;
};

export function registerMicroApps<T extends ObjectType>(
  apps: Array<RegistrableApp<T>>, // 等待注册的子应用
  lifeCycles?: FrameworkLifeCycles<T>, // 生命周期 {beforeMount , afterMount }
) {
  // Each app only needs to be registered once
  // 每个应用只需要注册一次 拿到没有注册过的应用
  // 用了name属性进行区分，所以name属性不能重复的
  const unregisteredApps = apps.filter((app) => !microApps.some((registeredApp) => registeredApp.name === app.name));
  // 已经注册过的应用 + 未注册过的应用 = 最新注册的应用
  microApps = [...microApps, ...unregisteredApps];

  unregisteredApps.forEach((app) => {
    // noop默认返回 undefined noop() => undefined， appConfig 其他应用配置
    const { name, activeRule, loader = noop, props, ...appConfig } = app;
    // 注册单个 app 就是single-spa的方法 路由劫持
    registerApplication({
      name,
      app: async () => {
        // 表示开始加载了
        loader(true);
        await frameworkStartedDefer.promise; // 等待调用start方法
        // mount 和其他的配置
        const {
          mount,
          ...otherMicroAppConfigs
        } = // loadApp返回值是一个 promise promise的值是函数
          // loadApp()()
          (await loadApp({ name, props, ...appConfig }, frameworkConfiguration, lifeCycles))(); // 等待promise完成执行函数

        return {
          // 返回的是应用的接入协议
          mount: [async () => loader(true), ...toArray(mount), async () => loader(false)],
          ...otherMicroAppConfigs,
        };
      },
      activeWhen: activeRule, // single-spa 何时激活
      customProps: props, // 自定义属性
    });
    // 还未执行具体逻辑 等待路径匹配后执行app方法
  });
}

const appConfigPromiseGetterMap = new Map<string, Promise<ParcelConfigObjectGetter>>();
const containerMicroAppsMap = new Map<string, MicroApp[]>();

export function loadMicroApp<T extends ObjectType>(
  app: LoadableApp<T>,
  configuration?: FrameworkConfiguration & { autoStart?: boolean },
  lifeCycles?: FrameworkLifeCycles<T>,
): MicroApp {
  const { props, name } = app;

  const container = 'container' in app ? app.container : undefined;
  // Must compute the container xpath at beginning to keep it consist around app running
  // If we compute it every time, the container dom structure most probably been changed and result in a different xpath value
  const containerXPath = getContainerXPath(container);
  const appContainerXPathKey = `${name}-${containerXPath}`;

  let microApp: MicroApp;
  const wrapParcelConfigForRemount = (config: ParcelConfigObject): ParcelConfigObject => {
    let microAppConfig = config;
    if (container) {
      if (containerXPath) {
        const containerMicroApps = containerMicroAppsMap.get(appContainerXPathKey);
        if (containerMicroApps?.length) {
          const mount = [
            async () => {
              // While there are multiple micro apps mounted on the same container, we must wait until the prev instances all had unmounted
              // Otherwise it will lead some concurrent issues
              const prevLoadMicroApps = containerMicroApps.slice(0, containerMicroApps.indexOf(microApp));
              const prevLoadMicroAppsWhichNotBroken = prevLoadMicroApps.filter(
                (v) => v.getStatus() !== 'LOAD_ERROR' && v.getStatus() !== 'SKIP_BECAUSE_BROKEN',
              );
              await Promise.all(prevLoadMicroAppsWhichNotBroken.map((v) => v.unmountPromise));
            },
            ...toArray(microAppConfig.mount),
          ];

          microAppConfig = {
            ...config,
            mount,
          };
        }
      }
    }

    return {
      ...microAppConfig,
      // empty bootstrap hook which should not run twice while it calling from cached micro app
      bootstrap: () => Promise.resolve(),
    };
  };

  /**
   * using name + container xpath as the micro app instance id,
   * it means if you rendering a micro app to a dom which have been rendered before,
   * the micro app would not load and evaluate its lifecycles again
   */
  const memorizedLoadingFn = async (): Promise<ParcelConfigObject> => {
    const userConfiguration = autoDowngradeForLowVersionBrowser(
      configuration ?? { ...frameworkConfiguration, singular: false },
    );
    const { $$cacheLifecycleByAppName } = userConfiguration;

    if (container) {
      // using appName as cache for internal experimental scenario
      if ($$cacheLifecycleByAppName) {
        const parcelConfigGetterPromise = appConfigPromiseGetterMap.get(name);
        if (parcelConfigGetterPromise) return wrapParcelConfigForRemount((await parcelConfigGetterPromise)(container));
      }

      if (containerXPath) {
        const parcelConfigGetterPromise = appConfigPromiseGetterMap.get(appContainerXPathKey);
        if (parcelConfigGetterPromise) return wrapParcelConfigForRemount((await parcelConfigGetterPromise)(container));
      }
    }

    const parcelConfigObjectGetterPromise = loadApp(app, userConfiguration, lifeCycles);

    if (container) {
      if ($$cacheLifecycleByAppName) {
        appConfigPromiseGetterMap.set(name, parcelConfigObjectGetterPromise);
      } else if (containerXPath) appConfigPromiseGetterMap.set(appContainerXPathKey, parcelConfigObjectGetterPromise);
    }

    return (await parcelConfigObjectGetterPromise)(container);
  };

  if (!started && configuration?.autoStart !== false) {
    // We need to invoke start method of single-spa as the popstate event should be dispatched while the main app calling pushState/replaceState automatically,
    // but in single-spa it will check the start status before it dispatch popstate
    // see https://github.com/single-spa/single-spa/blob/f28b5963be1484583a072c8145ac0b5a28d91235/src/navigation/navigation-events.js#L101
    // ref https://github.com/umijs/qiankun/pull/1071
    startSingleSpa({ urlRerouteOnly: frameworkConfiguration.urlRerouteOnly ?? defaultUrlRerouteOnly });
  }

  microApp = mountRootParcel(memorizedLoadingFn, { domElement: document.createElement('div'), ...props });

  if (container) {
    if (containerXPath) {
      // Store the microApps which they mounted on the same container
      const microAppsRef = containerMicroAppsMap.get(appContainerXPathKey) || [];
      microAppsRef.push(microApp);
      containerMicroAppsMap.set(appContainerXPathKey, microAppsRef);

      const cleanup = () => {
        const index = microAppsRef.indexOf(microApp);
        microAppsRef.splice(index, 1);
        // @ts-ignore
        microApp = null;
      };

      // gc after unmount
      microApp.unmountPromise.then(cleanup).catch(cleanup);
    }
  }

  return microApp;
}

/**
 * 开启
 * @param opts
 */
export function start(opts: FrameworkConfiguration = {}) {
  // prefetch 预取 预加载功能 提升性能
  // singular 单例模式
  // sandbox 沙箱
  frameworkConfiguration = { prefetch: true, singular: true, sandbox: true, ...opts };
  const { prefetch, urlRerouteOnly = defaultUrlRerouteOnly, ...importEntryOpts } = frameworkConfiguration;
  // 支持预加载 开启预加载策略
  if (prefetch) {
    doPrefetchStrategy(microApps, prefetch, importEntryOpts);
  }
  // 沙箱自动降级？ 不支持proxy
  frameworkConfiguration = autoDowngradeForLowVersionBrowser(frameworkConfiguration);
  // TODO 调用的是single-spa的start方法
  startSingleSpa({ urlRerouteOnly });
  started = true;
  // 调用start成功的promise
  frameworkStartedDefer.resolve();
}
