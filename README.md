# V9@Web

Currently working on debugging tools. 

### Installation

First, download the code.

```bash
git clone https://github.com/JianxinMa/v9.js.git
```

Then enter the `server` subdirectory.
```
cd v9.js/server
```

You need to set up a Node.js server under the `server` directory. It will listen at http://localhost:8080:
```bash
node server.js
```

After the server is established, go to https://JianxinMa.github.com/v9.js, or alternatively, open `index.html` under `v9.js`.

### Usage

The `Step` button is for single stepping. `Continue` button is for running until encountering a breakpoint. `Run` is similar to `Continue`, but ignores breakpoints. The three can be used in a mixed way. And yes, you can set breakpoints while it is running.

You can go to `Terminal` panel to interact with it while it is running.

