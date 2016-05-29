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
