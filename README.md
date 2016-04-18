# V9@Web

Currently working on debugging tools. See the [debugger design](doc/debugger.md) for more details.

## Usage

There is a live demo at https://JianxinMa.github.com/v9.js. Please read on for how to use it.

### Installation

#### step 0:

```bash
git clone https://github.com/JianxinMa/v9.js.git
```

#### step 1: 

Enter the `server` directory under `v9.js`.
```
cd v9.js/server
```

And set up a Node.js server when you are **under the `server` directory**. It will listen at http://localhost:8080:
```bash
node server.js
```

The server currently just sends you a precompiled `os` and `fs.img` whenever you click `Run`, `Step`, and `Continue`.

#### step 2:

Then go to https://JianxinMa.github.com/v9.js, or alternatively open the `index.html` udner `v9.js`.

### Normal Mode

Click the `Run` button to fire up the cpu in normal mode. You can go to `Terminal` panel to interact with the system.

### Debug Mode

The `Step` button is for single steping, while the `Continue` button is for running until encountering a break point.
`Step` and `Continue` can be used in a mixed way. You can click line numbers in the `Editor` to set break points.

#### 警告

现在还处于prototyping的阶段，会有很多很多bugs，请包容。

由于编译器生成的信息不准确、以及控制逻辑写得比较匆忙，调试功能在个别地方会出小问题。比如：

- 在个别地方可能会卡在断点、或重复执行，请取消该处断点；
- 一些地方设置断点会无效、单步时有时会偏差一行，主要是由于编译器提供的信息不准确；
- **尽管现在支持用户程序调试，从os到init再到sh大致能work，但是在sh里执行ls等不会去调试ls等程序，因为我忘了处理这种特殊情况，等我有空就来补。**

关于第一点，正在调查是程序本就该重复、还是调试器的问题。

另外，`Continue`正在跑的时候设置的断点需要在下一次`Continue`才生效，以后可能会改成动态设置断点。
