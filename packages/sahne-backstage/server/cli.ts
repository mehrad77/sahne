#!/usr/bin/env node
// node packages/sahne-backstage/server/cli.ts [--content <absolute folder>] [--port 5181] [--write]
// Backstage on the content root (default $SAHNE_CONTENT, or the samples), read-only unless --write.

import { parseArgs } from "node:util";
import { startBackstage } from "./index.ts";

const { values: o } = parseArgs({ options: { content: { type: "string" }, port: { type: "string", default: process.env.PORT ?? "5181" }, write: { type: "boolean", default: false } } });
const b = await startBackstage({ content: o.content, port: Number(o.port), write: o.write, log: true });
console.log(`sahne-backstage on ${b.url}${o.write ? "" : " (read-only: --write to save)"}`);
