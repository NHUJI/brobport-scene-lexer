# Brobport · 互动故事引擎 Demo

[在线演示](https://nhuji.github.io/brobport-scene-lexer/) · [互动故事引擎规格](SPEC.md)

1. 在「运行预览」选「核验记录」，查看 `verified` 的变化和执行记录，再点「重放选择」。
2. 点「重新开始」后选「跳过核验」，比较两个分支。也可以直接编辑 `.scene`，重新编译后在「Tokens」里看行号、缩进和 ID。
3. 在「规划依赖检查」切换到「循环依赖」，查看检查器找出的 `after` 等待路径。

## 本地运行

网页无需安装依赖。在仓库目录启动任意静态服务器，例如 `python3 -m http.server 8000`，然后访问 [localhost:8000](http://localhost:8000)。

命令行 lexer 示例使用 Node.js，每行输出一个 JSON token。

```sh
node example.mjs
```
