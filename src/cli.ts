#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getLibraryName } from "./index.js";

void yargs(hideBin(process.argv))
  .scriptName("mobile-context-trimmer")
  .usage("$0")
  .command(
    "$0",
    "Print basic package info",
    () => {},
    () => {
      process.stdout.write(`${getLibraryName()}\n`);
    }
  )
  .help()
  .strict()
  .parseAsync();
