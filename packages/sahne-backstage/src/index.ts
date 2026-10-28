// sahne-backstage in the browser: the editor's page (index.html loads the bundle of this file). The server is server/.

import { h, render } from "preact";
import { App } from "./ui/app.ts";
import { loadReview, loadWorld } from "./store.ts";

await Promise.all([loadWorld(), loadReview()]);
render(h(App, {}), document.getElementById("app")!);
