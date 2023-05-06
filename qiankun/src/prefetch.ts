/**
 * @author Kuitos
 * @since 2019-02-26
 */

import type { Entry, ImportEntryOpts } from 'import-html-entry';
import { importEntry } from 'import-html-entry';
import { isFunction } from 'lodash';
import { getAppStatus, getMountedApps, NOT_LOADED } from 'single-spa';
import type { AppMetadata, PrefetchStrategy } from './interfaces';

declare global {
  interface NetworkInformation {
    saveData: boolean;
    effectiveType: string;
  }
}
/**
 * requestIdleCallback 降级策略
 */
// RIC and shim for browsers setTimeout() without it
const requestIdleCallback =
  window.requestIdleCallback ||
  function requestIdleCallback(cb: CallableFunction) {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining() {
          return Math.max(0, 50 - (Date.now() - start));
        },
      });
    }, 1);
  };

declare global {
  interface Navigator {
    connection: {
      saveData: boolean;
      effectiveType: string;
      type: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
    };
  }
}

const isSlowNetwork = navigator.connection
  ? navigator.connection.saveData ||
    (navigator.connection.type !== 'wifi' &&
      navigator.connection.type !== 'ethernet' &&
      /([23])g/.test(navigator.connection.effectiveType))
  : false;

/**
 * prefetch assets, do nothing while in mobile network
 * @param entry
 * @param opts
 */
function prefetch(entry: Entry, opts?: ImportEntryOpts): void {
  // 没有网络 或者网络差（2g 3g） 不进行预加载
  if (!navigator.onLine || isSlowNetwork) {
    // Don't prefetch if in a slow network or offline
    return;
  }
  // 利用浏览器空闲时间 加载
  requestIdleCallback(async () => {
    // importEntry 拉取入口的html文件 获取额外的脚本和样式表
    // importEntry => import-html-entry 加载html 注释掉js和css文件
    const { getExternalScripts, getExternalStyleSheets } = await importEntry(entry, opts);
    requestIdleCallback(getExternalStyleSheets);
    requestIdleCallback(getExternalScripts);
  });
}
/**
 * 在第一个应用挂载完毕后 去预加载其他的应用
 * @param apps
 * @param opts
 */
function prefetchAfterFirstMounted(apps: AppMetadata[], opts?: ImportEntryOpts): void {
  // single-spa内部会派发一个事件 single-spa:first-mount 表示应用已经加载完毕了
  window.addEventListener('single-spa:first-mount', function listener() {
    // 拿到所有未加载的app
    const notLoadedApps = apps.filter((app) => getAppStatus(app.name) === NOT_LOADED);

    if (process.env.NODE_ENV === 'development') {
      const mountedApps = getMountedApps();
      console.log(`[qiankun] prefetch starting after ${mountedApps} mounted...`, notLoadedApps);
    }
    // 未加载的应用 依次去加载（空闲时间）
    notLoadedApps.forEach(({ entry }) => prefetch(entry, opts));
    // 加载完毕后 移除监听
    window.removeEventListener('single-spa:first-mount', listener);
  });
}

export function prefetchImmediately(apps: AppMetadata[], opts?: ImportEntryOpts): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[qiankun] prefetch starting for apps...', apps);
  }

  apps.forEach(({ entry }) => prefetch(entry, opts));
}

/**
 * 预先加载应用
 * @param apps
 * @param prefetchStrategy
 * @param importEntryOpts
 */
export function doPrefetchStrategy(
  apps: AppMetadata[], // 注册过的应用
  prefetchStrategy: PrefetchStrategy, // 预加载策略
  importEntryOpts?: ImportEntryOpts,
) {
  const appsName2Apps = (names: string[]): AppMetadata[] => apps.filter((app) => names.includes(app.name));

  if (Array.isArray(prefetchStrategy)) {
    prefetchAfterFirstMounted(appsName2Apps(prefetchStrategy as string[]), importEntryOpts);
  } else if (isFunction(prefetchStrategy)) {
    // prefetch: () => []
    (async () => {
      // critical rendering apps would be prefetch as earlier as possible
      const { criticalAppNames = [], minorAppsName = [] } = await prefetchStrategy(apps);
      prefetchImmediately(appsName2Apps(criticalAppNames), importEntryOpts);
      prefetchAfterFirstMounted(appsName2Apps(minorAppsName), importEntryOpts);
    })();
  } else {
    // prefetch = true
    switch (prefetchStrategy) {
      case true:
        // 在第一个应用挂载完毕后 去预加载其他的应用
        prefetchAfterFirstMounted(apps, importEntryOpts);
        break;

      case 'all':
        prefetchImmediately(apps, importEntryOpts);
        break;

      default:
        break;
    }
  }
}
