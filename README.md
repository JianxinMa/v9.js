# V9@Web

## What is this?

An in-browser operating system learning platform!

Not really production-ready yet. But stay tuned, we'll launch it before November.

## But why?

It can be tedious to set up a local environment for toying with operating systems. For example, you need `qemu`, `gcc-multilib`, and many other tools. Therefore we aim to provide an in-browser experience for all those interested in learning operating systems.

Even if you manage to set up a proper environment. Chances are that the operating systems you are learning are built for real-life hardwares like `x86`. As a result, you will be wasting much time dealing with dirty hardware details. Though it can be beneficial, it is daunting especially for beginners. Hence we aim to also use a much more simplified simulated hardware.

## Basic Usage

The `Step` button is for single stepping. `Continue` button is for running until encountering a breakpoint. `Run` is similar to `Continue`, but ignores breakpoints. The three can be used in a mixed way. And yes, you can set breakpoints while it is running.

You can go to `Terminal` panel to interact with it while it is running.

## Demo

#### Choose your target lab.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/choose.gif)

#### Browse files of your Lab.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/browse.gif)

#### Run your lab: xv6 or ucore.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/xv6run.gif)
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/lab8run.gif)

#### Run your lab until a break point.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/xv6break.gif)

#### Single step your lab.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/xv6step.gif)

#### Inspect variable values at runtime.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/xv6vars.gif)

#### Save all your hard work.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/xv6save.gif)

#### Continue your work next time.
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/xv6reuse.gif)

#### Want to Create a New Lab? Write a Config File for Your Sources!
![](https://github.com/JianxinMa/v9.js/raw/gh-pages/doc/gif/labcfg.gif)

## Development

#### How is the simulator implemented?

The JavaScript-implemented hardware simulator is manually translated from its C-implemented origin at [swieros](https://github.com/rswier/swieros). The reason we don't use tools such as [Emscripten](http://kripken.github.io/emscripten-site/) for this is that we find that Emscripten-converted code cannot fully interact with users. Though the reason is unclear.

And it also becomes much easier for us to add dubegging support once we have implemented our own JavaScript version.

#### How is the debugger implemented?

This is documented in [debugger.md](https://github.com/JianxinMa/v9.js/blob/gh-pages/doc/debugger.md).

## Related Work

- The JavaScript-implemented hardware simulator is manually translated from its C-implemented origin at [swieros](https://github.com/rswier/swieros).
- The C compiler is also based on that of [swieros](https://github.com/rswier/swieros).
- The simplified xv6 operating system is again from [swieros](https://github.com/rswier/swieros).
- [Emscripten](http://kripken.github.io/emscripten-site/) is used for converting the C-implemented C compiler to a JavaScript one.
- The C preprocessor is from [acgessler](https://github.com/acgessler/cpp.js).
- The [ucore](https://github.com/chyyuu) operating system is ported by Leonard Xu and Xu Han, see [v9-ucore](https://github.com/leopard1/v9-ucore).
- In fact, we have a second backend that uses a LLVM-based C compiler. See [Alex Wang's work](https://github.com/a1exwang/llvm).
- For this second backend, [a different instruction set](https://github.com/paulzfm/alex-machine) and hardware simulator is used. These are done by [Paul Zhu](https://github.com/paulzfm/v9.js). 

## Future Work

#### The C Preprocessor

Currently, variadic macros, ```__line__```, and ```__file___``` are not supported. But don't worry, we are working on them.

#### The C Compiler

Error messages from the C compiler of [swieros](https://github.com/rswier/swieros) are usually quite useless. And it also lack support of some ANSI C features. Although our other LLVM-based backend can overcome these issues, it turns out that the other backend requires much work from a server.

We plan to overcoem these by either:
- Improve the existing C compiler from [swieros](https://github.com/rswier/swieros).
- Or port [Tiny C Compiler](http://bellard.org/tcc/) to our platform, and put it at the front end.

#### Reliability

The ucore system is recently added, and hasn't been thoroughly tested yet. As a result, we are afraid that there might be some bugs in our hardware simulator and the ported system.
