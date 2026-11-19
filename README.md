# Brobport Scene Lexer

一个零依赖的 `.scene` 正文 lexer 示例。它逐行识别台词、演出指令、选项和跳转等语法，保留行号、缩进和 `^ID`。

完整设计见 [互动故事引擎规格](SPEC.md)。

```sh
node example.mjs
```

每行输出一个 JSON token。YAML 文件头、选项嵌套和条件表达式由后续解析处理。
