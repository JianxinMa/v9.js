# V9@Web

Currently working on porting the C compiler to JavaScript.

### Usage

A live [demo](http://166.111.68.197:11293/) is out!

The `Step` button is for single stepping. `Continue` button is for running until encountering a breakpoint. `Run` is similar to `Continue`, but ignores breakpoints. The three can be used in a mixed way. And yes, you can set breakpoints while it is running.

You can go to `Terminal` panel to interact with it while it is running.

### Deployment

First, download the code.
```bash
git clone https://github.com/JianxinMa/v9.js.git
```

Then enter the `server` subdirectory.
```
cd v9.js/server
```

Set up a Node.js server under the `server` directory.
```bash
sudo node server.js
```

It will listen at port 80.

Oops, there are some binary files. You need to run:
```bash
./init.sh
```
to generate binary files for your platform. You will need `gcc-multilib` to do so.
Note: we will remove dependency on these binary files later.
