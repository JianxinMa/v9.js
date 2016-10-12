import React from "react";
import injectTapEventPlugin from "react-tap-event-plugin";
import MuiThemeProvider from "material-ui/styles/MuiThemeProvider";
import AppBar from "material-ui/AppBar";
import Drawer from "material-ui/Drawer";
import FlatButton from "material-ui/FlatButton";
import RaisedButton from "material-ui/RaisedButton";
import MenuItem from "material-ui/MenuItem";
import CodeEditor from "./CodeEditor";
import Terminal from "./Terminal";
import "./App.css";

injectTapEventPlugin();

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isSideBarOpened: false,
            isTerminalOpened: false
        };
    }

    handleSideBarToggle = () => {
        this.setState({isSideBarOpened: !this.state.isSideBarOpened});
    };

    handleSideBarClose = () => {
        this.setState({isSideBarOpened: false});
    };

    handleTerminalToggle = () => {
        this.setState({isTerminalOpened: !this.state.isTerminalOpened});
    };

    handleTerminalClose = () => {
        this.setState({isTerminalOpened: false});
    };

    render() {
        return (
            <MuiThemeProvider>
                <div>
                    <AppBar title="Title"
                            iconClassNameRight="muidocs-icon-navigation-expand-more"
                            onLeftIconButtonTouchTap={this.handleSideBarToggle}>
                        <RaisedButton label="Terminal" style={{margin: 12}} onTouchTap={this.handleTerminalToggle}/>
                    </AppBar>
                    <Drawer docked={false} width={200} open={this.state.isSideBarOpened}
                            onRequestChange={(open) => this.setState({isSideBarOpened: open})}>
                        <MenuItem onTouchTap={this.handleSideBarClose}>Menu Item 1</MenuItem>
                        <MenuItem onTouchTap={this.handleSideBarClose}>Menu Item 2</MenuItem>
                    </Drawer>
                    <Drawer width={640} openSecondary={true} open={this.state.isTerminalOpened}>
                        <div>
                            <RaisedButton primary={true} label="Run" style={{margin: 12}}/>
                            <RaisedButton primary={true} label="Continue" style={{margin: 12}}/>
                            <RaisedButton primary={true} label="Step" style={{margin: 12}}/>
                            <RaisedButton disabled={true} label="Inspect" style={{margin: 12}}/>
                            <FlatButton label="Hide" style={{margin: 12}} onTouchTap={this.handleTerminalClose}/>
                        </div>
                        <Terminal/>
                    </Drawer>
                    <CodeEditor/>
                </div>
            </MuiThemeProvider>
        );
    }
}

export default App;
