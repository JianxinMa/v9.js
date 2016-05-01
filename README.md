# V9@Web

Currently working on debugging tools. 

## Usage

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

And set up a Node.js server under the `server` directory. It will listen at http://localhost:8080:
```bash
node server.js
```

#### step 2:

Then go to https://JianxinMa.github.com/v9.js, or alternatively open the `index.html` under `v9.js`.

### step 3:

The `Step` button is for single stepping. `Continue` button is for running until encountering a breakpoint. `Run` is similar to `Continue`, but faster as it ignores breakpoints. The three can be used in a mixed way. And yes, you can set breakpoints while it is running.

You can go to `Terminal` panel to interact with it while it is running.

