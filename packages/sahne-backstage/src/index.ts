// sahne-backstage in the browser: the editor's page (index.html loads the bundle of this file). The server is server/.

import { h, render } from "preact";
import { App } from "./ui/app.ts";
import { loadReview, loadWorld } from "./store.ts";
import { connectEvents } from "./events.ts";
import { loadSettings } from "./ui/settings.ts";
import { loadKitDocs } from "./kitdocs.ts";

await Promise.all([loadWorld(), loadReview(), loadKitDocs()]);
connectEvents();
void loadSettings();
render(h(App, {}), document.getElementById("app")!);
