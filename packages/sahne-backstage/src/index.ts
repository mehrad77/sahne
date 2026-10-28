// sahne-backstage in the browser: the editor's page (index.html loads the bundle of this file). The server is server/.

import { h, render } from "preact";
import { App } from "./ui/app.ts";
import { loadWorld } from "./store.ts";

await loadWorld();
render(h(App, {}), document.getElementById("app")!);
