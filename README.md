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

### Run in Normal Mode

### Run in Debug Mode

