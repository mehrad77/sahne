// sahne-backstage in the browser: the editor's page (index.html loads the bundle of this file). The server is server/.

import { h, render } from "preact";
import { App } from "./ui/app.ts";
import { loadReview, loadWorld } from "./store.ts";
import { connectEvents } from "./events.ts";
import { loadSettings } from "./ui/settings.ts";
import { loadKitDocs } from "./kitdocs.ts";

const [why] = await Promise.all([loadWorld(), loadReview(), loadKitDocs()]);
// a content root that does not read (a file that is not JSON): say so, and what to do, rather than a blank page
if (why) render(h("p", { style: "padding:20px" }, `${why}. Fix it, then reload this page.`), document.getElementById("app")!);
else {
  connectEvents();
  void loadSettings();
  render(h(App, {}), document.getElementById("app")!);
}
