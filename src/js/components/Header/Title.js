import React from "react";

export default class Title extends React.Component {
  render() {
    return <h1 style={{margin: "0px"}}>{this.props.title}</h1>;
  }
}
