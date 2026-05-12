# JavaScript 技能知识库

## 异步:Promise / async-await

### Promise 三态
pending → fulfilled / rejected,不可逆。

### 写法对照
```js
// Promise 链
fetch(url)
  .then((r) => r.json())
  .then((data) => console.log(data))
  .catch((err) => console.error(err));

// async/await(等价)
try {
  const r = await fetch(url);
  const data = await r.json();
  console.log(data);
} catch (err) {
  console.error(err);
}
```

### 并行 vs 串行
```js
// 串行:总耗时 = sum(每个)
for (const url of urls) {
  await fetch(url);
}

// 并行:总耗时 ≈ max(每个)
await Promise.all(urls.map((u) => fetch(u)));

// 部分失败也要继续
const results = await Promise.allSettled(urls.map((u) => fetch(u)));
// 每项是 { status: 'fulfilled'|'rejected', value|reason }
```

### 常见坑
- `forEach` 里的 `async` 不会被 `await`:改用 `for...of` 或 `Promise.all`
- Promise 构造函数里抛错不会被外层 try/catch 捕获,要 reject:
  ```js
  new Promise((resolve, reject) => {
    try { resolve(doSth()); } catch (e) { reject(e); }
  });
  ```
- `await` 在非 async 函数里是语法错误(顶层模块 ESM 下可以)

## 作用域 / this / 闭包

### let / const / var
| 关键字 | 作用域 | 提升 | 重复声明 |
|--------|--------|------|----------|
| `var` | 函数作用域 | 是(值为 undefined) | 允许 |
| `let` | 块作用域 | TDZ 暂时性死区 | 禁止 |
| `const` | 块作用域 | TDZ | 禁止,且不可重新赋值 |

### 箭头函数的 this
箭头函数不绑定自己的 `this`,继承定义位置的词法 this,因此不适合作对象方法:
```js
const obj = {
  n: 1,
  bad: () => this.n,      // undefined,this 指向外层
  good() { return this.n; } // 1
};
```

### 闭包
内层函数持有外层变量的引用。典型用法:
```js
function counter() {
  let n = 0;
  return { inc: () => ++n, get: () => n };
}
const c = counter();
c.inc(); c.inc(); c.get(); // 2
```

### 经典坑:循环里的 var
```js
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 3 3 3
}
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i)); // 0 1 2
}
```

## 模块

### ESM(现代推荐)
```js
// math.js
export const add = (a, b) => a + b;
export default function multiply(a, b) { return a * b; }

// main.js
import multiply, { add } from "./math.js";
```

### CommonJS(Node 传统)
```js
// math.js
module.exports = { add: (a, b) => a + b };

// main.js
const { add } = require("./math");
```

### 互操作
- Node `package.json` 加 `"type": "module"` → `.js` 默认 ESM
- `.mjs` 强制 ESM,`.cjs` 强制 CJS
- ESM 里引 CJS:`import pkg from "cjs-pkg"`,拿到 default export
- CJS 里引 ESM:只能用动态 `await import("esm-pkg")`

## 相等性陷阱
- `==` 会类型转换:`0 == "0" // true`,`null == undefined // true`
- `===` 严格相等,推荐默认用它
- `NaN !== NaN`,判定:`Number.isNaN(x)`
- `0 === -0 // true`,区分:`Object.is(0, -0) // false`

## 数组高频操作
```js
arr.map(fn)                // 变换
arr.filter(fn)             // 过滤
arr.reduce((acc, x) => ..., init)   // 聚合
arr.find(fn)               // 找第一个
arr.some(fn) / arr.every(fn)
[...arr1, ...arr2]         // 合并
Array.from(iterable)       // 类数组 → 数组
arr.flat(2)                // 摊平
arr.flatMap(fn)            // map + flat(1)
```

## 对象操作
```js
const { a, b = 1, ...rest } = obj;  // 解构 + 默认值 + 剩余
const merged = { ...obj1, ...obj2 }; // 浅合并
structuredClone(obj);               // 深拷贝(Node 17+)
Object.entries(obj)                 // [[k,v], ...]
Object.fromEntries(entries)         // 反向
```

## 原型与类
```js
class Animal {
  constructor(name) { this.name = name; }
  speak() { return `${this.name} makes a sound`; }
  static create(name) { return new Animal(name); }
}

class Dog extends Animal {
  speak() { return `${this.name} barks`; }
}

Object.getPrototypeOf(new Dog("Rex")) === Dog.prototype; // true
```

## 常见坑点

- 浮点:`0.1 + 0.2 === 0.30000000000000004`,金额用整数 / 字符串 / decimal 库
- 对象作为 key:`{} === {}` 是 false;要用 `Map`
- 数组判断:`Array.isArray(x)`,而不是 `typeof x === "object"`
- JSON 丢失:`JSON.stringify` 丢 undefined、function、Symbol
- `typeof null === "object"`(历史 bug)
