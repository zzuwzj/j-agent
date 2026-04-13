#!/usr/bin/env node

import { program } from "commander";
import pkg from "../package.json" with { type: "json" };

// 声明版本号命令，使用: ai-agent -v
program.version(pkg.version).description("AI Agent Command Line");

// 声明 start 命令，使用: ai-agent start
program
  .command("start")
  .description("Initialize AI Agent")
  .action(() => {
    console.log("Hello, AI Agent!");
  });

// 解析命令行参数并执行声明的命令
program.parse(process.argv);
