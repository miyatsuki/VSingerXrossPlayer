import React from "react";

export default class Header extends React.Component {
  render() {
    return (
      <div>
        <h1 style={{ margin: "0px", textAlign: "center" }}>
          {this.props.title}
        </h1>
      </div>
    );
  }
}
