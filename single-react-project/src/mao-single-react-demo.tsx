import React from "react";
import ReactDOM from "react-dom";
import singleSpaReact from "single-spa-react";
import Root from "./root.component";

// 生命周期
const lifecycles = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: Root,
  errorBoundary(err, info, props) {
    // Customize the root error boundary for your microfrontend here.
    return null;
  }
});
// 对于single-spa而言 暴露接入协议 就可以接入到项目中
export const { bootstrap, mount, unmount } = lifecycles;
